import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { HOOKIQ_SYSTEM_PROMPT, getDataTrendsPrompt, SOCIAL_TRENDS_PROMPT } from '@/lib/prompts'
import { fetchGoogleTrends, fetchYouTubeShorts } from '@/lib/trends-sources'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const user = session.user

    // Cache: return existing trends if fetched less than 4 hours ago
    const { data: cached } = await supabase
      .from('sessions')
      .select('result, created_at')
      .eq('user_id', user.id)
      .eq('type', 'trends')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cached?.result) {
      return NextResponse.json(cached.result)
    }

    // Fetch real data + AI calls in parallel
    const [googleTrends, youtubeShorts] = await Promise.all([
      fetchGoogleTrends(),
      fetchYouTubeShorts(),
    ])

    // Two parallel AI calls: mini for Google/YouTube data, search-preview for TikTok/Instagram
    const [dataResult, socialResult] = await Promise.all([
      // gpt-4o-mini: analyzes real fetched data (cheap)
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
          { role: 'user', content: getDataTrendsPrompt(googleTrends, youtubeShorts) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1200,
      }),
      // gpt-4o-search-preview: real-time TikTok + Instagram search (focused prompt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (openai.chat.completions.create as any)({
        model: 'gpt-4o-mini-search-preview',
        messages: [
          { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
          { role: 'user', content: SOCIAL_TRENDS_PROMPT },
        ],
        max_tokens: 1200,
      }),
    ])

    const dataTrends = JSON.parse(dataResult.choices[0].message.content ?? '{"trends":[]}')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socialContent = (socialResult as any).choices[0].message.content ?? '{"trends":[]}'
    const jsonMatch = socialContent.match(/\{[\s\S]*\}/)
    const socialTrends = JSON.parse(jsonMatch ? jsonMatch[0] : socialContent)

    // Merge: Google/YouTube trends + TikTok/Instagram trends
    const result = {
      trends: [
        ...(dataTrends.trends ?? []),
        ...(socialTrends.trends ?? []),
      ],
    }

    // Save to history (also serves as cache)
    await supabase.from('sessions').insert({
      user_id: user.id,
      type: 'trends',
      result,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Trends error:', error)
    return NextResponse.json({ error: 'Erro ao buscar trends' }, { status: 500 })
  }
}
