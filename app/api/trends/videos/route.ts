import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY!

// ── YouTube Data API (instantâneo, sem timeout) ───────────────────────────────

async function youtubeSearch(query: string): Promise<string[]> {
  if (!YOUTUBE_KEY) return []
  const params = new URLSearchParams({
    part: 'id',
    q: `${query} #shorts`,
    type: 'video',
    videoDuration: 'short',
    order: 'relevance',
    maxResults: '5',
    key: YOUTUBE_KEY,
  })
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).map((item: any) =>
      `https://www.youtube.com/watch?v=${item.id.videoId}`
    ).filter(Boolean)
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

function tiktokUrls(items: Record<string, unknown>[]): string[] {
  return items.flatMap(i => {
    if (typeof i.webVideoUrl === 'string' && i.webVideoUrl) return [i.webVideoUrl]
    if (typeof i.url === 'string' && i.url) return [i.url]
    return []
  })
}

function instagramUrls(items: Record<string, unknown>[]): string[] {
  return items.flatMap(i => {
    if (typeof i.url === 'string' && i.url) return [i.url]
    if (typeof i.shortCode === 'string') return [`https://www.instagram.com/p/${i.shortCode}/`]
    return []
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

  let videos: string[] = []

  if (/youtube|shorts/i.test(platform)) {
    // YouTube Data API — rápido e sem custo extra
    videos = await youtubeSearch(query)

  } else if (/tiktok/i.test(platform)) {
    const items = await runActor('clockworks~free-tiktok-scraper', {
      searchQueries: [query],
      resultsPerPage: 5,
      type: 'search',
    })
    videos = tiktokUrls(items)

  } else if (/instagram|reels/i.test(platform)) {
    const tag = query.replace(/\s+/g, '').toLowerCase()
    const items = await runActor('apify~instagram-scraper', {
      directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
      resultsType: 'posts',
      resultsLimit: 5,
    })
    videos = instagramUrls(items)
  }

  return NextResponse.json({ videos: videos.slice(0, 5) })
}
