import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { HOOKIQ_SYSTEM_PROMPT, getDataTrendsPrompt, getDataTrendsPromptForProfile, getSocialTrendsPromptShared } from '@/lib/prompts'
import { fetchGoogleTrendsUS, fetchYouTubeShortsGlobal, fetchAITrends, fetchHackerNewsTrends, fetchRedditBrTrends, fetchProductHuntTrends, fetchGoogleNewsBr, fetchArxivAI, fetchDevToTrending } from '@/lib/trends-sources'
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
  // referenceVideos: drop silently if malformed
  if (obj.referenceVideos !== undefined) {
    if (!Array.isArray(obj.referenceVideos) || !obj.referenceVideos.every((u: unknown) => typeof u === 'string')) {
      obj.referenceVideos = undefined
    }
  }
  // trendSource: drop if not a string
  if (obj.trendSource !== undefined && typeof obj.trendSource !== 'string') {
    obj.trendSource = undefined
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

/** Recover as many valid trend objects as possible from truncated JSON. */
function recoverTruncatedTrends(raw: string): unknown[] {
  const match = raw.match(/"trends"\s*:\s*\[/)
  if (!match || match.index === undefined) return []

  let remaining = raw.slice(match.index + match[0].length).trim()
  const trends: unknown[] = []

  while (remaining.startsWith('{')) {
    let depth = 0
    let i = 0
    for (; i < remaining.length; i++) {
      const ch = remaining[i]
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { i++; break } }
    }
    try {
      trends.push(JSON.parse(remaining.slice(0, i)))
      remaining = remaining.slice(i).replace(/^\s*,\s*/, '').trim()
    } catch { break }
  }
  return trends
}

function parseTrendsResult(source: string, raw: string): { trends: Trend[], metaTrend?: MetaTrend, errors: string[] } {
  const errors: string[] = []
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    // JSON truncated by max_tokens — try to recover complete trend objects
    const recovered = recoverTruncatedTrends(raw)
    if (recovered.length > 0) {
      errors.push(`${source}: JSON truncado, recuperados ${recovered.length} trends`)
      parsed = { trends: recovered }
    } else {
      errors.push(`${source}: JSON inválido — ${e instanceof Error ? e.message : String(e)}`)
      return { trends: [], errors }
    }
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

const TECH_SHORT_WORDS = new Set(['ai', 'ia', 'gpt', 'llm', 'api', 'rag', 'sdk', 'ux', 'ar', 'vr', 'ml'])

function getSignificantWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w =>
    w.length > 4 || TECH_SHORT_WORDS.has(w.replace(/[^a-z0-9]/g, ''))
  )
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
): Promise<{ trends: Trend[]; metaTrend?: MetaTrend; fetchedAt: string } | null> {
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
  return { trends: result.trends, metaTrend: result.metaTrend, fetchedAt: data.created_at }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // ── Read profile from body ──────────────────────────────────────────────
    let body: { profile?: 'ruan' | 'overlens' } = {}
    try { body = await request.json() } catch { /* empty body is fine */ }
    const profile: 'ruan' | 'overlens' = body.profile === 'ruan' ? 'ruan' : 'overlens'
    const dataCacheType   = profile === 'ruan' ? 'trends_data_ruan_v15'   : 'trends_data_overlens_v15'
    const socialCacheType = 'trends_social_v15' // shared across profiles — 1 AI call/day max

    // ── Check split Supabase cache ──────────────────────────────────────────
    const [cachedData, cachedSocial] = await Promise.all([
      loadSupabaseCache(supabase, user.id, dataCacheType,   DATA_CACHE_TTL),
      loadSupabaseCache(supabase, user.id, socialCacheType, SOCIAL_CACHE_TTL),
    ])

    // Treat empty-trends cache entries as misses — prevents stale empty entries blocking fresh fetches
    const effectiveCachedData   = (cachedData?.trends.length   ?? 0) > 0 ? cachedData   : null
    const effectiveCachedSocial = (cachedSocial?.trends.length ?? 0) > 0 ? cachedSocial : null

    let dataTrends:   Trend[]
    let socialTrends: Trend[]
    let dataMetaTrend: MetaTrend | undefined
    const _errors: string[] = []
    let dataRanAI   = false  // data AI model ran this request
    let socialRanAI = false  // social AI model ran this request

    if (effectiveCachedData && effectiveCachedSocial) {
      // Both caches valid — return merged without any AI call
      const allTrends = deduplicateTrends([...effectiveCachedData.trends, ...effectiveCachedSocial.trends])
      const reranked = allTrends
        .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
        .map((t, i) => ({ ...t, rank: i + 1 }))
      return NextResponse.json({
        trends: reranked,
        metaTrend: effectiveCachedData.metaTrend,
        _dataTrends: effectiveCachedData.trends,
        _socialTrends: effectiveCachedSocial.trends,
        _dataFetchedAt: effectiveCachedData.fetchedAt,
        _socialFetchedAt: effectiveCachedSocial.fetchedAt,
      })
    }

    if (effectiveCachedData) {
      // Only data cache valid — only call social model
      dataTrends = effectiveCachedData.trends
      dataMetaTrend = effectiveCachedData.metaTrend
      socialTrends = await (async (): Promise<Trend[]> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialResult = await (openai as any).responses.create({
            model: 'gpt-5-nano',
            tools: [{ type: 'web_search_preview' }],
            instructions: HOOKIQ_SYSTEM_PROMPT,
            input: getSocialTrendsPromptShared(),
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialContent = (socialResult as any).output_text ?? '{"trends":[]}'
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

      socialRanAI = true

    } else if (effectiveCachedSocial) {
      // Only social cache valid — only call data model (needs to fetch sources first)
      socialTrends = effectiveCachedSocial.trends

      const [googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr, arxivItems, devtoItems] = await Promise.all([
        fetchGoogleTrendsUS().catch(e => { console.error('[trends] Google Trends EUA falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleTrendsUS>> }),
        fetchYouTubeShortsGlobal().catch(e => { console.error('[trends] YouTube Shorts Global falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchYouTubeShortsGlobal>> }),
        fetchAITrends().catch(e => { console.error('[trends] YouTube AI Shorts falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchAITrends>> }),
        fetchHackerNewsTrends().catch(e => { console.error('[trends] HN falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchHackerNewsTrends>> }),
        fetchRedditBrTrends().catch(e => { console.error('[trends] Reddit BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchRedditBrTrends>> }),
        fetchProductHuntTrends().catch(e => { console.error('[trends] Product Hunt falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchProductHuntTrends>> }),
        fetchGoogleNewsBr().catch(e => { console.error('[trends] Google News BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleNewsBr>> }),
        fetchArxivAI().catch(e => { console.error('[trends] arXiv falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchArxivAI>> }),
        fetchDevToTrending().catch(e => { console.error('[trends] Dev.to falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchDevToTrending>> }),
      ])

      const dataResult2 = await (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dataResult = await (openai as any).responses.create({
            model: 'gpt-5-nano',
            tools: [{ type: 'web_search_preview' }],
            instructions: HOOKIQ_SYSTEM_PROMPT,
            input: getDataTrendsPromptForProfile(profile, googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr, arxivItems, devtoItems),
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = (dataResult as any).output_text ?? '{"trends":[]}'
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

      dataRanAI = true

    } else {
      // No cache — fetch all sources and run both AI models in parallel
      const [googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr, arxivItems, devtoItems] = await Promise.all([
        fetchGoogleTrendsUS().catch(e => { console.error('[trends] Google Trends EUA falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleTrendsUS>> }),
        fetchYouTubeShortsGlobal().catch(e => { console.error('[trends] YouTube Shorts Global falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchYouTubeShortsGlobal>> }),
        fetchAITrends().catch(e => { console.error('[trends] YouTube AI Shorts falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchAITrends>> }),
        fetchHackerNewsTrends().catch(e => { console.error('[trends] HN falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchHackerNewsTrends>> }),
        fetchRedditBrTrends().catch(e => { console.error('[trends] Reddit BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchRedditBrTrends>> }),
        fetchProductHuntTrends().catch(e => { console.error('[trends] Product Hunt falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchProductHuntTrends>> }),
        fetchGoogleNewsBr().catch(e => { console.error('[trends] Google News BR falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchGoogleNewsBr>> }),
        fetchArxivAI().catch(e => { console.error('[trends] arXiv falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchArxivAI>> }),
        fetchDevToTrending().catch(e => { console.error('[trends] Dev.to falhou:', e instanceof Error ? e.message : String(e)); return [] as Awaited<ReturnType<typeof fetchDevToTrending>> }),
      ])

      let rawDataMetaTrend: MetaTrend | undefined

      // Run sequentially to avoid hitting TPM rate limits (each model ~40-60k tokens)
      dataTrends = await (async (): Promise<Trend[]> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dataResult = await (openai as any).responses.create({
            model: 'gpt-5-nano',
            tools: [{ type: 'web_search_preview' }],
            instructions: HOOKIQ_SYSTEM_PROMPT,
            input: getDataTrendsPromptForProfile(profile, googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends, phTrends, newsBr, arxivItems, devtoItems),
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = (dataResult as any).output_text ?? '{"trends":[]}'
          const { trends, metaTrend, errors } = parseTrendsResult('openai-data', raw)
          if (errors.length > 0) console.error('[trends] Erros de validação (data model):', errors)
          rawDataMetaTrend = metaTrend
          return trends.map(t => ({ ...t, profile }))
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[trends] OpenAI data model falhou:', msg)
          _errors.push(`data-model: ${msg}`)
          return []
        }
      })()

      socialTrends = await (async (): Promise<Trend[]> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialResult = await (openai as any).responses.create({
            model: 'gpt-5-nano',
            tools: [{ type: 'web_search_preview' }],
            instructions: HOOKIQ_SYSTEM_PROMPT,
            input: getSocialTrendsPromptShared(),
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const socialContent = (socialResult as any).output_text ?? '{"trends":[]}'
          const jsonMatch = socialContent.match(/\{[\s\S]*\}/)
          const raw = jsonMatch ? jsonMatch[0] : socialContent
          const { trends, errors } = parseTrendsResult('openai-search', raw)
            if (errors.length > 0) console.error('[trends] Erros de validação (search model):', errors)
            return trends.map(t => ({ ...t, profile }))
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error('[trends] OpenAI search model falhou:', msg)
            _errors.push(`social-model: ${msg}`)
            return []
          }
        })()

      dataMetaTrend = rawDataMetaTrend

      dataRanAI   = true
      socialRanAI = true
    }

    // ── Ensure originCountry is set on all trends ────────────────────────────
    // The AI may omit originCountry on some trends. Default to 'EUA' for both
    // profiles since both prioritise international (US-origin) trends.
    // Trends the AI already set as 'Brasil' are preserved.
    const ensureOriginCountry = (trends: Trend[]): Trend[] =>
      trends.map(t => ({
        ...t,
        originCountry: t.originCountry ?? ('EUA' as const),
      }))

    dataTrends   = ensureOriginCountry(dataTrends)
    socialTrends = ensureOriginCountry(socialTrends)

    // If both AI sources failed, return a clear degraded error
    if (dataTrends.length === 0 && socialTrends.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma fonte de trends disponível no momento', source: 'all', details: 'Ambos os modelos de IA falharam ou retornaram dados inválidos', _errors },
        { status: 503 }
      )
    }

    // ── Persist caches immediately (without videos) ──────────────────────────
    if (dataRanAI || socialRanAI) {
      const saves: PromiseLike<unknown>[] = []
      if (dataRanAI)   saves.push(supabase.from('sessions').insert({ user_id: user.id, type: dataCacheType,   result: { trends: dataTrends,   metaTrend: dataMetaTrend } }))
      if (socialRanAI) saves.push(supabase.from('sessions').insert({ user_id: user.id, type: socialCacheType, result: { trends: socialTrends } }))
      await Promise.all(saves)
    }

    // ── Deduplicate + re-rank ────────────────────────────────────────────────
    const allTrends: Trend[] = [...dataTrends, ...socialTrends]
    const deduplicated = deduplicateTrends(allTrends)
    const reranked = deduplicated
      .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
      .map((t, i) => ({ ...t, rank: i + 1 }))

    const now = new Date().toISOString()
    return NextResponse.json({
      trends: reranked,
      metaTrend: dataMetaTrend,
      _dataTrends: dataTrends,
      _socialTrends: socialTrends,
      _dataFetchedAt: now,
      _socialFetchedAt: now,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[trends] Erro inesperado:', msg)
    return NextResponse.json({ error: 'Erro ao buscar trends', source: 'unknown', details: msg }, { status: 500 })
  }
}
