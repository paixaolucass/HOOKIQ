import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { HOOKIQ_SYSTEM_PROMPT, getDataTrendsPrompt, getDataTrendsPromptForProfile, getSocialTrendsPrompt } from '@/lib/prompts'
import { fetchGoogleTrendsUS, fetchYouTubeShortsGlobal, fetchAITrends, fetchHackerNewsTrends, fetchRedditBrTrends, fetchProductHuntTrends, fetchGoogleNewsBr } from '@/lib/trends-sources'
import { DATA_CACHE_TTL, SOCIAL_CACHE_TTL } from '@/lib/trends-cache'
import type { Trend, MetaTrend } from '@/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Manual validation (no zod dependency) ─────────────────────────────────────

function isValidCompetitorVolume(v: unknown): v is 'baixo' | 'médio' | 'alto' {
  return v === 'baixo' || v === 'médio' || v === 'alto'
}

function isValidRecommendation(v: unknown): v is 'entrar agora' | 'entrar com ângulo diferente' | 'evitar' {
  return v === 'entrar agora' || v === 'entrar com ângulo diferente' || v === 'evitar'
}

function isValidWindow(v: unknown): v is 'ABERTA' | 'FECHANDO' | 'FECHADA' {
  return v === 'ABERTA' || v === 'FECHANDO' || v === 'FECHADA'
}

function validateTrend(t: unknown): t is Trend {
  if (!t || typeof t !== 'object') return false
  const obj = t as Record<string, unknown>
  if (typeof obj.id !== 'number') return false
  if (!isValidWindow(obj.window)) return false
  if (typeof obj.platform !== 'string') return false
  if (typeof obj.superficialSubject !== 'string') return false
  if (typeof obj.realFormat !== 'string') return false
  if (typeof obj.overlensAngle !== 'string') return false
  if (typeof obj.urgency !== 'string') return false

  // Optional fields — validate shape if present
  if (obj.rank !== undefined && typeof obj.rank !== 'number') return false
  // Optional fields — validate loosely (don't reject the whole trend over a bad optional field)
  if (obj.rankScore !== undefined && typeof obj.rankScore !== 'number') return false
  // Clamp rankScore silently rather than rejecting
  if (typeof obj.rankScore === 'number') obj.rankScore = Math.max(0, Math.min(10, obj.rankScore))
  // saturationEstimate: drop silently if malformed rather than rejecting the trend
  if (obj.saturationEstimate !== undefined) {
    const sat = obj.saturationEstimate as Record<string, unknown>
    if (
      typeof sat.daysRemaining !== 'number' ||
      !isValidCompetitorVolume(sat.competitorVolume) ||
      !isValidRecommendation(sat.recommendation)
    ) {
      obj.saturationEstimate = undefined
    }
  }
  // rhetoric: clamp scores rather than rejecting
  if (obj.rhetoric !== undefined) {
    const r = obj.rhetoric as Record<string, unknown>
    for (const dim of ['ethos', 'pathos', 'logos']) {
      const d = r[dim] as Record<string, unknown>
      if (!d || typeof d.score !== 'number') { obj.rhetoric = undefined; break }
      d.score = Math.max(0, Math.min(2, d.score))
    }
  }
  return true
}

function parseMetaTrend(v: unknown): MetaTrend | undefined {
  if (!v || typeof v !== 'object') return undefined
  const obj = v as Record<string, unknown>
  if (
    typeof obj.theme !== 'string' ||
    typeof obj.description !== 'string' ||
    !Array.isArray(obj.trendIds) ||
    typeof obj.overlensOpportunity !== 'string'
  ) return undefined
  if (!obj.trendIds.every((x: unknown) => typeof x === 'number')) return undefined
  return {
    theme: obj.theme,
    description: obj.description,
    trendIds: obj.trendIds as number[],
    overlensOpportunity: obj.overlensOpportunity,
  }
}

function parseTrendsResult(source: string, raw: string): { trends: Trend[], metaTrend?: MetaTrend, errors: string[] } {
  const errors: string[] = []
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    errors.push(`${source}: JSON inválido — ${e instanceof Error ? e.message : String(e)}`)
    return { trends: [], errors }
  }

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.trends)) {
    errors.push(`${source}: campo "trends" ausente ou não é array`)
    return { trends: [], errors }
  }

  const valid: Trend[] = []
  for (const item of obj.trends) {
    if (validateTrend(item)) {
      valid.push(item)
    } else {
      const id = (item as Record<string, unknown>)?.id
      errors.push(`${source}: trend id=${id ?? '?'} falhou na validação — descartada`)
    }
  }

  const metaTrend = parseMetaTrend(obj.metaTrend)

  return { trends: valid, metaTrend, errors }
}

// ── Deduplication ──────────────────────────────────────────────────────────────

function getSignificantWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
}

function deduplicateTrends(trends: Trend[]): Trend[] {
  const groups: Trend[][] = []
  const used = new Set<number>()

  for (let i = 0; i < trends.length; i++) {
    if (used.has(i)) continue
    const group = [trends[i]]
    const wordsI = getSignificantWords(trends[i].superficialSubject)
    for (let j = i + 1; j < trends.length; j++) {
      if (used.has(j)) continue
      const wordsJ = getSignificantWords(trends[j].superficialSubject)
      const common = wordsI.filter(w => wordsJ.includes(w))
      if (common.length >= 2) {
        group.push(trends[j])
        used.add(j)
      }
    }
    used.add(i)
    groups.push(group)
  }

  return groups.map(group => {
    if (group.length === 1) return group[0]
    const best = group.reduce((a, b) => (a.rankScore ?? 0) >= (b.rankScore ?? 0) ? a : b)
    const platforms = [...new Set(group.map(t => t.platform))].join(' + ')
    return { ...best, platform: platforms }
  })
}

// ── Supabase cache helpers ─────────────────────────────────────────────────────

async function loadSupabaseCache(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  _userId: string,
  type: string,
  ttlMs: number,
): Promise<{ trends: Trend[]; metaTrend?: MetaTrend } | null> {
  // Cache is shared across all users — first fetch of the period serves everyone
  const { data } = await supabase
    .from('sessions')
    .select('result, created_at')
    .eq('type', type)
    .gte('created_at', new Date(Date.now() - ttlMs).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.result) return null
  const result = data.result as { trends?: Trend[]; metaTrend?: MetaTrend }
  if (!Array.isArray(result.trends)) return null
  return { trends: result.trends, metaTrend: result.metaTrend }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const user = session.user

    // ── Read profile from body ──────────────────────────────────────────────
    let body: { profile?: 'ruan' | 'overlens' } = {}
    try { body = await request.json() } catch { /* empty body is fine */ }
    const profile: 'ruan' | 'overlens' = body.profile === 'ruan' ? 'ruan' : 'overlens'
    const dataCacheType   = profile === 'ruan' ? 'trends_data_ruan'   : 'trends_data_overlens'
    const socialCacheType = profile === 'ruan' ? 'trends_social_ruan' : 'trends_social_overlens'

    // ── Check split Supabase cache ──────────────────────────────────────────
    const [cachedData, cachedSocial] = await Promise.all([
      loadSupabaseCache(supabase, user.id, dataCacheType,   DATA_CACHE_TTL),
      loadSupabaseCache(supabase, user.id, socialCacheType, SOCIAL_CACHE_TTL),
    ])

    let dataTrends:   Trend[]
    let socialTrends: Trend[]
    let dataMetaTrend: MetaTrend | undefined

    if (cachedData && cachedSocial) {
      // Both caches valid — return merged without any AI call
      const allTrends = deduplicateTrends([...cachedData.trends, ...cachedSocial.trends])
      const reranked = allTrends
        .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
        .map((t, i) => ({ ...t, rank: i + 1 }))
      return NextResponse.json({
        trends: reranked,
        metaTrend: cachedData.metaTrend,
        _dataTrends: cachedData.trends,
        _socialTrends: cachedSocial.trends,
      })
    }

    if (cachedData) {
      // Only data cache valid — only call social model
      dataTrends = cachedData.trends
      dataMetaTrend = cachedData.metaTrend
      socialTrends = await (async (): Promise<Trend[]> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialResult = await (openai.chat.completions.create as any)({
            model: 'gpt-4o-mini-search-preview',
            messages: [
              { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
              { role: 'user', content: getSocialTrendsPrompt(profile) },
            ],
            max_tokens: 4000,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialContent = (socialResult as any).choices[0].message.content ?? '{"trends":[]}'
          const jsonMatch = socialContent.match(/\{[\s\S]*\}/)
          const raw = jsonMatch ? jsonMatch[0] : socialContent
          const { trends, errors } = parseTrendsResult('openai-search', raw)
          if (errors.length > 0) console.error('[trends] Erros de validação (search model):', errors)
          return trends
        } catch (e) {
          console.error('[trends] OpenAI search model falhou:', e instanceof Error ? e.message : String(e))
          return []
        }
      })()

      // Persist new social cache
      await supabase.from('sessions').insert({ user_id: user.id, type: socialCacheType, result: { trends: socialTrends } })

    } else if (cachedSocial) {
      // Only social cache valid — only call data model (needs to fetch sources first)
      socialTrends = cachedSocial.trends

      const [googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr] = await Promise.all([
        fetchGoogleTrendsUS().catch(e => { console.error('[trends] Google Trends EUA falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleTrendsUS>> }),
        fetchYouTubeShortsGlobal().catch(e => { console.error('[trends] YouTube Shorts Global falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchYouTubeShortsGlobal>> }),
        fetchAITrends().catch(e => { console.error('[trends] YouTube AI Shorts falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchAITrends>> }),
        fetchHackerNewsTrends().catch(e => { console.error('[trends] HN falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchHackerNewsTrends>> }),
        fetchRedditBrTrends().catch(e => { console.error('[trends] Reddit BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchRedditBrTrends>> }),
        fetchProductHuntTrends().catch(e => { console.error('[trends] Product Hunt falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchProductHuntTrends>> }),
        fetchGoogleNewsBr().catch(e => { console.error('[trends] Google News BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleNewsBr>> }),
      ])

      const dataResult2 = await (async () => {
        try {
          const dataResult = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
              { role: 'user', content: getDataTrendsPromptForProfile(profile, googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr) },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.4,
            max_tokens: 4000,
          })
          const raw = dataResult.choices[0].message.content ?? '{"trends":[]}'
          const { trends, metaTrend, errors } = parseTrendsResult('openai-data', raw)
          if (errors.length > 0) console.error('[trends] Erros de validação (data model):', errors)
          return { trends: trends.map(t => ({ ...t, profile })), metaTrend }
        } catch (e) {
          console.error('[trends] OpenAI data model falhou:', e instanceof Error ? e.message : String(e))
          return { trends: [] as Trend[], metaTrend: undefined }
        }
      })()

      dataTrends = dataResult2.trends
      dataMetaTrend = dataResult2.metaTrend

      // Persist new data cache
      await supabase.from('sessions').insert({ user_id: user.id, type: dataCacheType, result: { trends: dataTrends, metaTrend: dataMetaTrend } })

    } else {
      // No cache — fetch all sources and run both AI models in parallel
      const [googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr] = await Promise.all([
        fetchGoogleTrendsUS().catch(e => { console.error('[trends] Google Trends EUA falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleTrendsUS>> }),
        fetchYouTubeShortsGlobal().catch(e => { console.error('[trends] YouTube Shorts Global falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchYouTubeShortsGlobal>> }),
        fetchAITrends().catch(e => { console.error('[trends] YouTube AI Shorts falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchAITrends>> }),
        fetchHackerNewsTrends().catch(e => { console.error('[trends] HN falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchHackerNewsTrends>> }),
        fetchRedditBrTrends().catch(e => { console.error('[trends] Reddit BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchRedditBrTrends>> }),
        fetchProductHuntTrends().catch(e => { console.error('[trends] Product Hunt falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchProductHuntTrends>> }),
        fetchGoogleNewsBr().catch(e => { console.error('[trends] Google News BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleNewsBr>> }),
      ])

      let rawDataMetaTrend: MetaTrend | undefined
      ;[dataTrends, socialTrends] = await Promise.all([
        // Source: gpt-4o-mini — analyzes real fetched data (profile-aware)
        (async (): Promise<Trend[]> => {
          try {
            const dataResult = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
                { role: 'user', content: getDataTrendsPromptForProfile(profile, googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr) },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.4,
              max_tokens: 8000,
            })
            const raw = dataResult.choices[0].message.content ?? '{"trends":[]}'
            const { trends, metaTrend, errors } = parseTrendsResult('openai-data', raw)
            if (errors.length > 0) console.error('[trends] Erros de validação (data model):', errors)
            rawDataMetaTrend = metaTrend
            return trends.map(t => ({ ...t, profile }))
          } catch (e) {
            console.error('[trends] OpenAI data model falhou:', e instanceof Error ? e.message : String(e))
            return []
          }
        })(),

        // Source: gpt-4o-mini-search-preview — real-time TikTok + Instagram search
        (async (): Promise<Trend[]> => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const socialResult = await (openai.chat.completions.create as any)({
              model: 'gpt-4o-mini-search-preview',
              messages: [
                { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
                { role: 'user', content: getSocialTrendsPrompt(profile) },
              ],
              max_tokens: 8000,
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const socialContent = (socialResult as any).choices[0].message.content ?? '{"trends":[]}'
            const jsonMatch = socialContent.match(/\{[\s\S]*\}/)
            const raw = jsonMatch ? jsonMatch[0] : socialContent
            const { trends, errors } = parseTrendsResult('openai-search', raw)
            if (errors.length > 0) console.error('[trends] Erros de validação (search model):', errors)
            return trends.map(t => ({ ...t, profile }))
          } catch (e) {
            console.error('[trends] OpenAI search model falhou:', e instanceof Error ? e.message : String(e))
            return []
          }
        })(),
      ])

      dataMetaTrend = rawDataMetaTrend

      // Persist both caches
      await Promise.all([
        supabase.from('sessions').insert({ user_id: user.id, type: dataCacheType,    result: { trends: dataTrends, metaTrend: dataMetaTrend } }),
        supabase.from('sessions').insert({ user_id: user.id, type: socialCacheType, result: { trends: socialTrends } }),
      ])
    }

    // ── Ensure originCountry is set on all trends ────────────────────────────
    // The AI may omit originCountry on some trends. Default to 'EUA' for both
    // profiles since both prioritise international (US-origin) trends.
    // Trends the AI already set as 'Brasil' are preserved.
    const ensureOriginCountry = (trends: Trend[]): Trend[] =>
      trends.map(t => ({
        ...t,
        originCountry: (t as unknown as Record<string, unknown>).originCountry
          ? (t as unknown as Record<string, unknown>).originCountry
          : 'EUA',
      }))

    dataTrends   = ensureOriginCountry(dataTrends)
    socialTrends = ensureOriginCountry(socialTrends)

    // If both AI sources failed, return a clear degraded error
    if (dataTrends.length === 0 && socialTrends.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma fonte de trends disponível no momento', source: 'all', details: 'Ambos os modelos de IA falharam ou retornaram dados inválidos' },
        { status: 503 }
      )
    }

    // ── Deduplicate + re-rank ────────────────────────────────────────────────
    const allTrends: Trend[] = [...dataTrends, ...socialTrends]
    const deduplicated = deduplicateTrends(allTrends)
    const reranked = deduplicated
      .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
      .map((t, i) => ({ ...t, rank: i + 1 }))

    return NextResponse.json({
      trends: reranked,
      metaTrend: dataMetaTrend,
      _dataTrends: dataTrends,
      _socialTrends: socialTrends,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[trends] Erro inesperado:', msg)
    return NextResponse.json({ error: 'Erro ao buscar trends', source: 'unknown', details: msg }, { status: 500 })
  }
}
