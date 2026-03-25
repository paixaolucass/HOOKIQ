import { AnalysisResult } from '@/types'

export const CACHE_KEY = 'hookiq_trends'
export const CACHE_MS  = 4 * 60 * 60 * 1000 // 4 horas

export interface TrendsCache {
  result: AnalysisResult
  fetchedAt: string
}

export function loadTrendsCache(): TrendsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TrendsCache
  } catch { return null }
}

export function saveTrendsCache(result: AnalysisResult) {
  const fetchedAt = new Date().toISOString()
  localStorage.setItem(CACHE_KEY, JSON.stringify({ result, fetchedAt } satisfies TrendsCache))
  return fetchedAt
}

export function isCacheValid(fetchedAt: string) {
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_MS
}

export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora mesmo'
  if (diff < 60) return `há ${diff} min`
  return `há ${Math.floor(diff / 60)}h`
}

export function remainingTime(iso: string) {
  const remaining = Math.max(0, CACHE_MS - (Date.now() - new Date(iso).getTime()))
  const totalMin = Math.floor(remaining / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

// Fetch trends respecting local cache — returns [data, fromCache]
export async function fetchTrendsWithCache(): Promise<[AnalysisResult, boolean]> {
  const cache = loadTrendsCache()
  if (cache && isCacheValid(cache.fetchedAt)) {
    return [cache.result, true]
  }
  const res = await fetch('/api/trends', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar trends')
  saveTrendsCache(data)
  return [data, false]
}
