import { AnalysisResult, Trend } from '@/types'

export const CACHE_VERSION = '3'

// TTLs
export const DATA_CACHE_TTL   = 6 * 60 * 60 * 1000  // 6h — Google/YouTube/HN/Reddit
export const SOCIAL_CACHE_TTL = 2 * 60 * 60 * 1000  // 2h — TikTok/Instagram

// localStorage keys (versioned so old caches are discarded automatically)
const DATA_CACHE_KEY   = `hookiq_trends_data_v${CACHE_VERSION}`
const SOCIAL_CACHE_KEY = `hookiq_trends_social_v${CACHE_VERSION}`

// Per-profile social cache keys
export const SOCIAL_CACHE_KEY_RUAN    = `hookiq_trends_social_ruan_v${CACHE_VERSION}`
export const SOCIAL_CACHE_KEY_OVERLENS = `hookiq_trends_social_overlens_v${CACHE_VERSION}`

// ── Per-type cache entries ─────────────────────────────────────────────────────

export interface TrendsCacheEntry {
  version: string
  trends: Trend[]
  fetchedAt: string
}

// ── Data cache (6h) ────────────────────────────────────────────────────────────

export function loadDataCache(): TrendsCacheEntry | null {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TrendsCacheEntry
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(DATA_CACHE_KEY)
      return null
    }
    return parsed
  } catch { return null }
}

export function saveDataCache(trends: Trend[]): string {
  const fetchedAt = new Date().toISOString()
  const entry: TrendsCacheEntry = { version: CACHE_VERSION, trends, fetchedAt }
  localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(entry))
  return fetchedAt
}

export function isDataCacheValid(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < DATA_CACHE_TTL
}

// ── Social cache (2h) ──────────────────────────────────────────────────────────

export function loadSocialCache(profile?: 'ruan' | 'overlens'): TrendsCacheEntry | null {
  const key = profile === 'ruan'
    ? SOCIAL_CACHE_KEY_RUAN
    : profile === 'overlens'
      ? SOCIAL_CACHE_KEY_OVERLENS
      : SOCIAL_CACHE_KEY
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TrendsCacheEntry
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch { return null }
}

export function saveSocialCache(trends: Trend[], profile?: 'ruan' | 'overlens'): string {
  const key = profile === 'ruan'
    ? SOCIAL_CACHE_KEY_RUAN
    : profile === 'overlens'
      ? SOCIAL_CACHE_KEY_OVERLENS
      : SOCIAL_CACHE_KEY
  const fetchedAt = new Date().toISOString()
  const entry: TrendsCacheEntry = { version: CACHE_VERSION, trends, fetchedAt }
  localStorage.setItem(key, JSON.stringify(entry))
  return fetchedAt
}

export function isSocialCacheValid(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < SOCIAL_CACHE_TTL
}

// ── Combined helpers used by pages ────────────────────────────────────────────

/**
 * Returns the earliest-expiring fetchedAt among cached entries, or null if none.
 * CacheStatus should display this value so the user knows when the next refresh is due.
 */
export function getEarliestFetchedAt(): string | null {
  const data   = loadDataCache()
  const social = loadSocialCache()

  if (!data && !social) return null
  if (data && !social)  return data.fetchedAt
  if (!data && social)  return social.fetchedAt

  // Return the one that will expire first (the more recent fetch has less time remaining
  // only if TTLs differ — pick the one with least remaining time)
  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(data!.fetchedAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(social!.fetchedAt).getTime())
  return dataRemaining <= socialRemaining ? data!.fetchedAt : social!.fetchedAt
}

/**
 * Returns the effective TTL for the cache entry that will expire first.
 * Used by remainingTime() so it uses the right TTL for the right entry.
 */
export function getEarliestTTL(): number {
  const data   = loadDataCache()
  const social = loadSocialCache()

  if (!data && !social) return SOCIAL_CACHE_TTL
  if (data && !social)  return DATA_CACHE_TTL
  if (!data && social)  return SOCIAL_CACHE_TTL

  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(data!.fetchedAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(social!.fetchedAt).getTime())
  return dataRemaining <= socialRemaining ? DATA_CACHE_TTL : SOCIAL_CACHE_TTL
}

/**
 * True if ANY cached entry has expired (meaning a refresh is due).
 */
export function isAnyCacheExpired(): boolean {
  const data   = loadDataCache()
  const social = loadSocialCache()
  if (!data   || !isDataCacheValid(data.fetchedAt))     return true
  if (!social || !isSocialCacheValid(social.fetchedAt)) return true
  return false
}

// ── Merged result helpers ──────────────────────────────────────────────────────

/** Build a merged AnalysisResult from both local caches (returns null if both empty). */
export function loadMergedCacheResult(): AnalysisResult | null {
  const data   = loadDataCache()
  const social = loadSocialCache()

  const dataTrends   = data?.trends   ?? []
  const socialTrends = social?.trends ?? []
  const all = [...dataTrends, ...socialTrends]
  if (all.length === 0) return null

  const sorted = all
    .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
    .map((t, i) => ({ ...t, rank: i + 1 }))

  return { trends: sorted }
}

/** Save split trends back to localStorage from a full merged AnalysisResult. */
export function saveSplitCaches(dataTrends: Trend[], socialTrends: Trend[], profile?: 'ruan' | 'overlens'): string {
  const dataAt   = saveDataCache(dataTrends)
  const socialAt = saveSocialCache(socialTrends, profile)
  // Return the timestamp that will expire first
  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(dataAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(socialAt).getTime())
  return dataRemaining <= socialRemaining ? dataAt : socialAt
}

// ── Legacy single-entry helpers (kept for backward compatibility) ──────────────
// These now delegate to the split caches so existing call sites (page.tsx) keep working.

/** @deprecated Use loadMergedCacheResult + isAnyCacheExpired instead. */
export interface TrendsCache {
  version: string
  result: AnalysisResult
  fetchedAt: string
}

/** @deprecated */
export function loadTrendsCache(): TrendsCache | null {
  const merged = loadMergedCacheResult()
  if (!merged) return null
  const fetchedAt = getEarliestFetchedAt() ?? new Date().toISOString()
  return { version: CACHE_VERSION, result: merged, fetchedAt }
}

/** @deprecated */
export function isCacheValid(fetchedAt: string): boolean {
  // Use the tightest TTL (social, 2h) for backward compatibility
  return !isAnyCacheExpired()
}

// ── Time display helpers ───────────────────────────────────────────────────────

export function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora mesmo'
  if (diff < 60) return `há ${diff} min`
  return `há ${Math.floor(diff / 60)}h`
}

export function remainingTime(iso: string, ttl?: number) {
  const effectiveTtl = ttl ?? getEarliestTTL()
  const remaining = Math.max(0, effectiveTtl - (Date.now() - new Date(iso).getTime()))
  const totalMin = Math.floor(remaining / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

// ── Fetch helper used by pages ─────────────────────────────────────────────────

/** Fetch trends respecting local split caches — returns [data, fromCache]. */
export async function fetchTrendsWithCache(): Promise<[AnalysisResult, boolean]> {
  if (!isAnyCacheExpired()) {
    const merged = loadMergedCacheResult()
    if (merged) return [merged, true]
  }

  const res = await fetch('/api/trends', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar trends')
  // The route now returns { trends, _dataTrends, _socialTrends } — split and cache
  const dt = (data._dataTrends  ?? []) as Trend[]
  const st = (data._socialTrends ?? []) as Trend[]
  if (dt.length > 0 || st.length > 0) {
    saveSplitCaches(dt, st)
  }
  // Return the clean result (without internal _* fields)
  const clean: AnalysisResult = { trends: data.trends }
  return [clean, false]
}
