import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!

// ── Actor IDs ─────────────────────────────────────────────────────────────────

const ACTORS = {
  youtube:   'streamers~youtube-scraper',
  tiktok:    'clockworks~free-tiktok-scraper',
  instagram: 'apify~instagram-scraper',
}

// ── Apify helper ──────────────────────────────────────────────────────────────

async function runActor(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=50`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(55_000),
    }
  )
  if (!res.ok) return []
  return res.json()
}

// ── URL extractors ─────────────────────────────────────────────────────────────

function youtubeUrls(items: Record<string, unknown>[]): string[] {
  return items.flatMap(i => {
    if (typeof i.url === 'string' && i.url) return [i.url]
    if (typeof i.id === 'string') return [`https://www.youtube.com/watch?v=${i.id}`]
    return []
  })
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

  if (/tiktok.*instagram|instagram.*tiktok/i.test(platform)) {
    // Combined platform — TikTok first
    const items = await runActor(ACTORS.tiktok, {
      searchQueries: [query],
      resultsPerPage: 6,
      type: 'search',
    })
    videos = tiktokUrls(items)

  } else if (/youtube|shorts/i.test(platform)) {
    const items = await runActor(ACTORS.youtube, {
      searchKeywords: `${query} #shorts`,
      maxResults: 6,
      type: 'SEARCH',
    })
    videos = youtubeUrls(items)

  } else if (/tiktok/i.test(platform)) {
    const items = await runActor(ACTORS.tiktok, {
      searchQueries: [query],
      resultsPerPage: 6,
      type: 'search',
    })
    videos = tiktokUrls(items)

  } else if (/instagram|reels/i.test(platform)) {
    const tag = query.replace(/\s+/g, '').toLowerCase()
    const items = await runActor(ACTORS.instagram, {
      directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
      resultsType: 'posts',
      resultsLimit: 6,
    })
    videos = instagramUrls(items)
  }

  return NextResponse.json({ videos: videos.slice(0, 5) })
}
