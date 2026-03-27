import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY!

export interface VideoResult {
  url: string
  views?: number
}

// ── YouTube Data API ──────────────────────────────────────────────────────────

async function youtubeSearch(query: string): Promise<VideoResult[]> {
  if (!YOUTUBE_KEY) return []

  // 14 dias — janela relevante pra trend viral
  const publishedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Buscar IDs ordenados por viewCount
  const searchParams = new URLSearchParams({
    part: 'id',
    q: `${query} #shorts`,
    type: 'video',
    videoDuration: 'short',
    order: 'viewCount',
    maxResults: '5',
    publishedAfter,
    key: YOUTUBE_KEY,
  })

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids: string[] = (searchData.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean)
    if (ids.length === 0) return []

    // 2. Buscar estatísticas (viewCount) — 1 quota unit
    const statsParams = new URLSearchParams({
      part: 'statistics',
      id: ids.join(','),
      key: YOUTUBE_KEY,
    })
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${statsParams}`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (!statsRes.ok) {
      return ids.map(id => ({ url: `https://www.youtube.com/watch?v=${id}` }))
    }
    const statsData = await statsRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (statsData.items ?? []).map((item: any) => ({
      url: `https://www.youtube.com/watch?v=${item.id}`,
      views: parseInt(item.statistics?.viewCount ?? '0', 10),
    }))
  } catch {
    return []
  }
}

// ── Apify helper (TikTok / Instagram) ────────────────────────────────────────

async function runActor(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=25`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

function tiktokResults(items: Record<string, unknown>[]): VideoResult[] {
  return items.flatMap(i => {
    const url = (typeof i.webVideoUrl === 'string' ? i.webVideoUrl : null)
      ?? (typeof i.url === 'string' ? i.url : null)
    if (!url) return []
    return [{ url, views: typeof i.playCount === 'number' ? i.playCount : undefined }]
  })
}

function instagramResults(items: Record<string, unknown>[]): VideoResult[] {
  return items.flatMap(i => {
    const url = (typeof i.url === 'string' ? i.url : null)
      ?? (typeof i.shortCode === 'string' ? `https://www.instagram.com/p/${i.shortCode}/` : null)
    if (!url) return []
    return [{ url, views: typeof i.videoPlayCount === 'number' ? i.videoPlayCount : undefined }]
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query    = searchParams.get('q')?.trim()
  const platform = searchParams.get('platform')?.trim() ?? ''

  if (!query) return NextResponse.json({ error: 'q é obrigatório' }, { status: 400 })

  let videos: VideoResult[] = []

  if (/youtube|shorts/i.test(platform)) {
    videos = await youtubeSearch(query)

  } else if (/tiktok/i.test(platform)) {
    const items = await runActor('clockworks~free-tiktok-scraper', {
      searchQueries: [query],
      resultsPerPage: 5,
      type: 'search',
    })
    videos = tiktokResults(items)

  } else if (/instagram|reels/i.test(platform)) {
    const tag = query.replace(/\s+/g, '').toLowerCase()
    const items = await runActor('apify~instagram-scraper', {
      directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
      resultsType: 'posts',
      resultsLimit: 5,
    })
    videos = instagramResults(items)
  }

  return NextResponse.json({ videos: videos.slice(0, 5) })
}
