import { AnalysisResult, Trend } from '@/types'

export const CACHE_VERSION = '3'

// TTLs
export const DATA_CACHE_TTL   = 12 * 60 * 60 * 1000  // 12h — Google/YouTube/HN/Reddit
export const SOCIAL_CACHE_TTL =  4 * 60 * 60 * 1000  //  4h — TikTok/Instagram

// Per-profile data cache keys
const DATA_CACHE_KEY_RUAN     = `hookiq_trends_data_ruan_v${CACHE_VERSION}`
const DATA_CACHE_KEY_OVERLENS = `hookiq_trends_data_overlens_v${CACHE_VERSION}`

// Per-profile social cache keys
export const SOCIAL_CACHE_KEY_RUAN     = `hookiq_trends_social_ruan_v${CACHE_VERSION}`
export const SOCIAL_CACHE_KEY_OVERLENS = `hookiq_trends_social_overlens_v${CACHE_VERSION}`

// Legacy (unprofile'd) keys — kept only so old entries can be evicted silently
const LEGACY_DATA_CACHE_KEY   = `hookiq_trends_data_v${CACHE_VERSION}`
const LEGACY_SOCIAL_CACHE_KEY = `hookiq_trends_social_v${CACHE_VERSION}`

// ── Per-type cache entries ─────────────────────────────────────────────────────

export interface TrendsCacheEntry {
  version: string
  trends: Trend[]
  fetchedAt: string
}

function dataKey(profile?: 'ruan' | 'overlens'): string {
  return profile === 'ruan' ? DATA_CACHE_KEY_RUAN : DATA_CACHE_KEY_OVERLENS
}

function socialKey(profile?: 'ruan' | 'overlens'): string {
  if (profile === 'ruan')     return SOCIAL_CACHE_KEY_RUAN
  if (profile === 'overlens') return SOCIAL_CACHE_KEY_OVERLENS
  return LEGACY_SOCIAL_CACHE_KEY
}

// ── Data cache (6h, per-profile) ───────────────────────────────────────────────

export function loadDataCache(profile?: 'ruan' | 'overlens'): TrendsCacheEntry | null {
  // Evict legacy shared key silently
  localStorage.removeItem(LEGACY_DATA_CACHE_KEY)
  try {
    const raw = localStorage.getItem(dataKey(profile))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TrendsCacheEntry
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(dataKey(profile))
      return null
    }
    return parsed
  } catch { return null }
}

export function saveDataCache(trends: Trend[], profile?: 'ruan' | 'overlens'): string {
  const fetchedAt = new Date().toISOString()
  const entry: TrendsCacheEntry = { version: CACHE_VERSION, trends, fetchedAt }
  localStorage.setItem(dataKey(profile), JSON.stringify(entry))
  return fetchedAt
}

export function isDataCacheValid(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < DATA_CACHE_TTL
}

// ── Social cache (2h, per-profile) ─────────────────────────────────────────────

export function loadSocialCache(profile?: 'ruan' | 'overlens'): TrendsCacheEntry | null {
  try {
    const raw = localStorage.getItem(socialKey(profile))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TrendsCacheEntry
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(socialKey(profile))
      return null
    }
    return parsed
  } catch { return null }
}

export function saveSocialCache(trends: Trend[], profile?: 'ruan' | 'overlens'): string {
  const key = socialKey(profile)
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
 */
export function getEarliestFetchedAt(profile?: 'ruan' | 'overlens'): string | null {
  const data   = loadDataCache(profile)
  const social = loadSocialCache(profile)

  if (!data && !social) return null
  if (data && !social)  return data.fetchedAt
  if (!data && social)  return social.fetchedAt

  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(data!.fetchedAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(social!.fetchedAt).getTime())
  return dataRemaining <= socialRemaining ? data!.fetchedAt : social!.fetchedAt
}

/**
 * Returns the effective TTL for the cache entry that will expire first.
 */
export function getEarliestTTL(profile?: 'ruan' | 'overlens'): number {
  const data   = loadDataCache(profile)
  const social = loadSocialCache(profile)

  if (!data && !social) return SOCIAL_CACHE_TTL
  if (data && !social)  return DATA_CACHE_TTL
  if (!data && social)  return SOCIAL_CACHE_TTL

  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(data!.fetchedAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(social!.fetchedAt).getTime())
  return dataRemaining <= socialRemaining ? DATA_CACHE_TTL : SOCIAL_CACHE_TTL
}

/**
 * True if ANY cached entry for this profile has expired (meaning a refresh is due).
 */
export function isAnyCacheExpired(profile?: 'ruan' | 'overlens'): boolean {
  const data   = loadDataCache(profile)
  const social = loadSocialCache(profile)
  if (!data   || !isDataCacheValid(data.fetchedAt))     return true
  if (!social || !isSocialCacheValid(social.fetchedAt)) return true
  return false
}

// ── Merged result helpers ──────────────────────────────────────────────────────

/** Build a merged AnalysisResult from both local caches (returns null if both empty). */
export function loadMergedCacheResult(profile?: 'ruan' | 'overlens'): AnalysisResult | null {
  const data   = loadDataCache(profile)
  const social = loadSocialCache(profile)

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
  const dataAt   = saveDataCache(dataTrends, profile)
  const socialAt = saveSocialCache(socialTrends, profile)
  // Return the timestamp that will expire first
  const dataRemaining   = DATA_CACHE_TTL   - (Date.now() - new Date(dataAt).getTime())
  const socialRemaining = SOCIAL_CACHE_TTL - (Date.now() - new Date(socialAt).getTime())
  return dataRemaining <= socialRemaining ? dataAt : socialAt
}

// ── Legacy single-entry helpers (kept for backward compatibility) ──────────────

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
  const dt = (data._dataTrends  ?? []) as Trend[]
  const st = (data._socialTrends ?? []) as Trend[]
  if (dt.length > 0 || st.length > 0) {
    saveSplitCaches(dt, st)
  }
  const clean: AnalysisResult = { trends: data.trends }
  return [clean, false]
}
