export interface GoogleTrendItem {
  title: string
  traffic: string
}

export interface YouTubeShortItem {
  title: string
  channelTitle: string
}

export async function fetchGoogleTrends(): Promise<GoogleTrendItem[]> {
  try {
    const res = await fetch(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR',
      { cache: 'no-store' }
    )
    if (!res.ok) return []

    const xml = await res.text()
    const items: GoogleTrendItem[] = []

    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const itemXml = match[1]
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/)
      const trafficMatch = itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)
      if (titleMatch) {
        items.push({
          title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
          traffic: trafficMatch?.[1] ?? '',
        })
      }
    }

    return items.slice(0, 20)
  } catch {
    return []
  }
}

export async function fetchYouTubeShorts(): Promise<YouTubeShortItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  try {
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({
      part: 'snippet',
      q: '#shorts IA criatividade design fotografia conteúdo',
      type: 'video',
      videoDuration: 'short',
      order: 'viewCount',
      maxResults: '15',
      regionCode: 'BR',
      publishedAfter,
      key: apiKey,
    })

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []

    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.items ?? []).map((item: any) => ({
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    }))
  } catch {
    return []
  }
}
