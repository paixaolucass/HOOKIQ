export interface GoogleTrendItem {
  title: string
  traffic: string
}

export interface ArxivItem {
  title: string
  summary: string
}

export interface DevToItem {
  title: string
  tags: string
}

export interface YouTubeShortItem {
  title: string
  channelTitle: string
}

export interface HackerNewsItem {
  title: string
  score: number
  url: string
}

export interface RedditBrItem {
  title: string
  score: number
  subreddit: string
}

export interface ProductHuntItem {
  title: string
  description: string
}

export interface GoogleNewsItem {
  title: string
  publishedAt: string
}

async function parseGoogleTrendsRSS(xml: string): Promise<GoogleTrendItem[]> {
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
  return items.slice(0, 10)
}

const GOOGLE_TRENDS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; hookiq-trends/1.0)',
  'Accept': 'application/rss+xml, application/xml, text/xml',
}

export async function fetchGoogleTrends(): Promise<GoogleTrendItem[]> {
  try {
    const res = await fetch(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR',
      { cache: 'no-store', headers: GOOGLE_TRENDS_HEADERS }
    )
    if (!res.ok) return []
    const xml = await res.text()
    return parseGoogleTrendsRSS(xml)
  } catch {
    return []
  }
}

export async function fetchGoogleTrendsUS(): Promise<GoogleTrendItem[]> {
  try {
    const res = await fetch(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US',
      { cache: 'no-store', headers: GOOGLE_TRENDS_HEADERS }
    )
    if (!res.ok) return []
    const xml = await res.text()
    return parseGoogleTrendsRSS(xml)
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
      maxResults: '8',
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

export async function fetchYouTubeShortsGlobal(): Promise<YouTubeShortItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  try {
    const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({
      part: 'snippet',
      q: '#shorts AI creativity design content creator',
      type: 'video',
      videoDuration: 'short',
      order: 'viewCount',
      maxResults: '8',
      regionCode: 'US',
      relevanceLanguage: 'en',
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

const HN_KEYWORDS = ['AI', 'LLM', 'GPT', 'Claude', 'image', 'video', 'design', 'creative', 'generative', 'automation', 'workflow']

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export async function fetchHackerNewsTrends(): Promise<HackerNewsItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { cache: 'no-store' })
        if (!res.ok) return []
        const ids: number[] = await res.json()
        const top30 = ids.slice(0, 20)

        // Fetch items in parallel, max 15 at a time
        const chunks: number[][] = []
        for (let i = 0; i < top30.length; i += 15) chunks.push(top30.slice(i, i + 15))

        const items: HackerNewsItem[] = []
        for (const chunk of chunks) {
          const results = await Promise.all(
            chunk.map(id =>
              fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cache: 'no-store' })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            )
          )
          for (const item of results) {
            if (!item || typeof item.title !== 'string' || typeof item.score !== 'number') continue
            if (item.score <= 20) continue
            const titleLower = item.title.toLowerCase()
            if (!HN_KEYWORDS.some(kw => titleLower.includes(kw.toLowerCase()))) continue
            items.push({
              title: item.title,
              score: item.score,
              url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
            })
          }
        }
        return items.slice(0, 10)
      })(),
      5000
    )
    return result
  } catch {
    return []
  }
}

export async function fetchRedditBrTrends(): Promise<RedditBrItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch(
          'https://www.reddit.com/r/brdev+artificialintelligence+ChatGPT/hot.json?limit=25&t=day',
          { cache: 'no-store', headers: { 'User-Agent': 'hookiq-trends/1.0' } }
        )
        if (!res.ok) return []
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children: any[] = data?.data?.children ?? []
        return children
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((c: any) => ({
            title: c.data?.title ?? '',
            score: c.data?.score ?? 0,
            subreddit: c.data?.subreddit ?? '',
          }))
          .filter((p: RedditBrItem) => p.score > 10 && p.title)
          .slice(0, 6)
      })(),
      5000
    )
    return result
  } catch {
    return []
  }
}

const PH_KEYWORDS = ['AI', 'artificial intelligence', 'GPT', 'LLM', 'image', 'video', 'design', 'creative', 'generative', 'automation', 'workflow', 'Claude', 'Midjourney', 'Stable Diffusion']

export async function fetchProductHuntTrends(): Promise<ProductHuntItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch('https://www.producthunt.com/feed', {
          cache: 'no-store',
          headers: { 'User-Agent': 'hookiq-trends/1.0' },
        })
        if (!res.ok) return []

        const xml = await res.text()
        const items: ProductHuntItem[] = []

        for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const itemXml = match[1]
          const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
          const descMatch  = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)

          const title = titleMatch?.[1]?.trim() ?? ''
          const description = descMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''

          if (!title) continue

          const combined = (title + ' ' + description).toLowerCase()
          if (!PH_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()))) continue

          items.push({ title, description })
          if (items.length >= 6) break
        }

        return items
      })(),
      5000
    )
    return result
  } catch {
    return []
  }
}

export async function fetchGoogleNewsBr(): Promise<GoogleNewsItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch(
          'https://news.google.com/rss/search?q=intelig%C3%AAncia+artificial+OR+%22IA+generativa%22+OR+ChatGPT&hl=pt-BR&gl=BR&ceid=BR:pt-419',
          { cache: 'no-store', headers: { 'User-Agent': 'hookiq-trends/1.0' } }
        )
        if (!res.ok) return []

        const xml = await res.text()
        const cutoff = Date.now() - 48 * 60 * 60 * 1000
        const items: GoogleNewsItem[] = []

        for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const itemXml = match[1]
          const titleMatch   = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
          const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)

          const title       = titleMatch?.[1]?.trim() ?? ''
          const publishedAt = pubDateMatch?.[1]?.trim() ?? ''

          if (!title) continue
          if (publishedAt) {
            const ts = Date.parse(publishedAt)
            if (!isNaN(ts) && ts < cutoff) continue
          }

          items.push({ title, publishedAt })
          if (items.length >= 8) break
        }

        return items
      })(),
      5000
    )
    return result
  } catch {
    return []
  }
}

const AI_QUERIES = [
  '#shorts inteligência artificial',
  '#shorts IA ferramenta',
  '#shorts ChatGPT',
  '#shorts Midjourney',
  '#shorts automação IA',
  '#shorts IA para criadores',
]

export async function fetchAITrends(): Promise<YouTubeShortItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  try {
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % AI_QUERIES.length
    const query = AI_QUERIES[dayIndex]
    const publishedAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoDuration: 'short',
      order: 'viewCount',
      maxResults: '6',
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

const ARXIV_KEYWORDS = ['diffusion', 'multimodal', 'vision', 'image', 'video', 'generation', 'agent', 'reasoning', 'llm', 'language model', 'creative', 'design', 'text-to', 'clip', 'stable', 'latent']

export async function fetchArxivAI(): Promise<ArxivItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch(
          'https://rss.arxiv.org/rss/cs.AI+cs.CL+cs.CV',
          { cache: 'no-store', headers: { 'User-Agent': 'hookiq-trends/1.0', 'Accept': 'application/rss+xml' } }
        )
        if (!res.ok) return []
        const xml = await res.text()
        const items: ArxivItem[] = []
        for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const itemXml = match[1]
          const titleMatch   = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
          const summaryMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
          const title   = titleMatch?.[1]?.trim().replace(/\s+/g, ' ') ?? ''
          const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 200) ?? ''
          if (!title) continue
          const combined = (title + ' ' + summary).toLowerCase()
          if (!ARXIV_KEYWORDS.some(kw => combined.includes(kw))) continue
          items.push({ title, summary })
          if (items.length >= 5) break
        }
        return items
      })(),
      6000
    )
    return result
  } catch {
    return []
  }
}

export async function fetchDevToTrending(): Promise<DevToItem[]> {
  try {
    const result = await withTimeout(
      (async () => {
        const res = await fetch(
          'https://dev.to/api/articles?top=3&per_page=8',
          { cache: 'no-store', headers: { 'User-Agent': 'hookiq-trends/1.0' } }
        )
        if (!res.ok) return []
        const data: any[] = await res.json()
        return data
          .filter((a: any) => a.title && Array.isArray(a.tag_list))
          .slice(0, 10)
          .map((a: any) => ({
            title: a.title,
            tags: (a.tag_list as string[]).slice(0, 4).join(', '),
          }))
      })(),
      5000
    )
    return result
  } catch {
    return []
  }
}
