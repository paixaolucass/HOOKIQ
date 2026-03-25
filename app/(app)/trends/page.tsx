'use client'

import { useState, useEffect, useRef } from 'react'
import { AnalysisResult, Trend, TrendWindow, MetaTrend } from '@/types'
import TrendCard from '@/components/TrendCard'
import ExportBar from '@/components/ExportBar'
import CacheStatus from '@/components/CacheStatus'
import { ChevronDown, ChevronUp, Copy, Check, GripVertical } from 'lucide-react'

import {
  loadTrendsCache,
  isAnyCacheExpired,
  getEarliestFetchedAt,
} from '@/lib/trends-cache'
import { LOADING_STEPS } from '@/lib/loading-steps'

// ── localStorage keys ─────────────────────────────────────────────────────────

const PREVIOUS_KEY = 'hookiq_trends_previous'
const MANUAL_ORDER_KEY = 'hookiq_trends_manual_order'

type FilterWindow   = TrendWindow | 'TODAS'
type FilterPlatform = 'TODAS' | 'Google Trends' | 'YouTube Shorts' | 'TikTok' | 'Instagram' | 'Hacker News' | 'Reddit'
type Profile = 'ruan' | 'overlens'

const WINDOW_OPTIONS:   FilterWindow[]   = ['TODAS', 'ABERTA', 'FECHANDO', 'FECHADA']
const PLATFORM_OPTIONS: FilterPlatform[] = ['TODAS', 'Google Trends', 'YouTube Shorts', 'TikTok', 'Instagram', 'Hacker News', 'Reddit']

// ── New-trend detection helpers ───────────────────────────────────────────────

function getSignificantWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
}

function isTrendNew(trend: Trend, previous: Trend[]): boolean {
  if (previous.length === 0) return true
  const wordsA = getSignificantWords(trend.superficialSubject)
  for (const prev of previous) {
    const wordsB = getSignificantWords(prev.superficialSubject)
    const common = wordsA.filter(w => wordsB.includes(w))
    if (common.length >= 2) return false
  }
  return true
}

function markNewTrends(trends: Trend[], previous: Trend[]): Trend[] {
  return trends.map(t => ({ ...t, isNew: isTrendNew(t, previous) }))
}

function loadPreviousTrends(): Trend[] {
  try {
    const raw = localStorage.getItem(PREVIOUS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Trend[]
  } catch { return [] }
}

function savePreviousTrends(trends: Trend[]) {
  localStorage.setItem(PREVIOUS_KEY, JSON.stringify(trends))
}

// ── Manual order helpers ──────────────────────────────────────────────────────

function loadManualOrder(): number[] | null {
  try {
    const raw = localStorage.getItem(MANUAL_ORDER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as number[]
  } catch { return null }
}

function saveManualOrder(ids: number[]) {
  localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(ids))
}

function applyManualOrder(trends: Trend[], order: number[]): Trend[] {
  const map = new Map(trends.map(t => [t.id, t]))
  const result: Trend[] = []
  for (const id of order) {
    if (map.has(id)) {
      result.push(map.get(id)!)
      map.delete(id)
    }
  }
  // append any not in saved order
  for (const t of map.values()) result.push(t)
  return result
}

// ── Loading panel ─────────────────────────────────────────────────────────────

function LoadingPanel({ step }: { step: string }) {
  return (
    <div className="space-y-8 py-10">
      {/* Spinner central */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-white animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-xl font-medium text-[#e5e5e5]">{step}</p>
          <p className="text-xs text-[#444] animate-pulse">Isso pode levar até 40 segundos</p>
        </div>
      </div>

      {/* Skeleton cards */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border border-white/10 p-4 animate-pulse">
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 bg-white/10 rounded flex-shrink-0" />
              <div className="flex-1 h-4 bg-white/10 rounded" />
              <div className="w-16 h-4 bg-white/10 rounded" />
              <div className="w-20 h-4 bg-white/10 rounded" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-3 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function TrendCardSkeleton() {
  return (
    <div className="border border-white/10 rounded-lg p-4 animate-pulse">
      <div className="flex gap-3 items-center">
        <div className="w-8 h-8 bg-white/10 rounded" />
        <div className="flex-1 h-4 bg-white/10 rounded" />
        <div className="w-16 h-4 bg-white/10 rounded" />
        <div className="w-20 h-4 bg-white/10 rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  )
}

// ── Formatos em alta ──────────────────────────────────────────────────────────

interface FormatGroup {
  name: string
  count: number
  platforms: string[]
  avgRankScore: number
}

function buildFormatGroups(trends: Trend[]): FormatGroup[] {
  const groups: { indices: number[] }[] = []
  const assigned = new Set<number>()

  for (let i = 0; i < trends.length; i++) {
    if (assigned.has(i)) continue
    const group = { indices: [i] }
    const wordsI = getSignificantWords(trends[i].realFormat)
    for (let j = i + 1; j < trends.length; j++) {
      if (assigned.has(j)) continue
      const wordsJ = getSignificantWords(trends[j].realFormat)
      const common = wordsI.filter(w => wordsJ.includes(w))
      if (common.length >= 2) {
        group.indices.push(j)
        assigned.add(j)
      }
    }
    if (group.indices.length >= 2) {
      assigned.add(i)
      groups.push(group)
    }
  }

  return groups.map(g => {
    const items = g.indices.map(i => trends[i])
    const best = items.reduce((a, b) =>
      (a.realFormat.length >= b.realFormat.length ? a : b)
    )
    const allPlatforms = [...new Set(items.flatMap(t => t.platform.split(' + ')))]
    const avgRankScore = items.reduce((s, t) => s + (t.rankScore ?? 0), 0) / items.length
    return {
      name: best.realFormat,
      count: items.length,
      platforms: allPlatforms,
      avgRankScore: Math.round(avgRankScore * 10) / 10,
    }
  }).sort((a, b) => b.count - a.count || b.avgRankScore - a.avgRankScore)
}

function FormatsSection({ trends }: { trends: Trend[] }) {
  const [open, setOpen] = useState(false)
  const groups = buildFormatGroups(trends)
  if (groups.length === 0) return null

  return (
    <div className="mt-6 border border-[#1a1a1a]">
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#111] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xs text-[#444] uppercase tracking-widest">
          Formatos em alta esta semana
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#333]">{groups.length} formato{groups.length !== 1 ? 's' : ''}</span>
          {open
            ? <ChevronUp size={12} className="text-[#333]" />
            : <ChevronDown size={12} className="text-[#333]" />
          }
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-[#1a1a1a]">
          {groups.map((g, i) => (
            <div key={i} className="flex items-start gap-4 pt-3">
              <div className="flex-1">
                <p className="text-sm text-[#e5e5e5] mb-1">{g.name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-[#555]">
                  {g.platforms.map(p => (
                    <span key={p} className="border border-[#1a1a1a] px-1.5 py-0.5">{p}</span>
                  ))}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-mono text-[#e5e5e5]">{g.count} trend{g.count !== 1 ? 's' : ''}</p>
                <p className="text-xs text-[#444]">score médio {g.avgRankScore}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Briefing copy button ──────────────────────────────────────────────────────

function BriefingCopyButton({ trends }: { trends: Trend[] }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    // Top 3 ABERTAS, or top 3 by rank if not enough
    const abertas = trends.filter(t => t.window === 'ABERTA')
    const top3 = abertas.length >= 3
      ? abertas.slice(0, 3)
      : [...trends].sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id)).slice(0, 3)

    const today = new Date().toLocaleDateString('pt-BR')
    const windowEmoji = (w: TrendWindow) => w === 'ABERTA' ? '🟢' : w === 'FECHANDO' ? '🟡' : '🔴'

    const lines: string[] = [
      `📊 RADAR DE TRENDS — ${today}`,
      '',
    ]

    top3.forEach((t, i) => {
      lines.push(`${windowEmoji(t.window)} #${i + 1} — ${t.superficialSubject}`)
      lines.push(`Formato: ${t.realFormat}`)
      lines.push(`Plataforma: ${t.platform}`)
      lines.push(`Ângulo Overlens: ${t.overlensAngle}`)
      if (t.hookAngle) lines.push(`Gancho: "${t.hookAngle}"`)
      if (t.executionTip) lines.push(`Como executar: ${t.executionTip}`)
      lines.push(`Urgência: ${t.urgency}`)
      if (i < top3.length - 1) lines.push('')
    })

    lines.push('')
    lines.push('Gerado pelo HOOKIQ')

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
        copied
          ? 'border-[#22c55e] text-[#22c55e]'
          : 'border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444]'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copiado!' : 'Copiar briefing'}
    </button>
  )
}

// ── MetaTrend card ────────────────────────────────────────────────────────────

function MetaTrendCard({ metaTrend, onScrollToTrend }: { metaTrend: MetaTrend; onScrollToTrend: (id: number) => void }) {
  return (
    <div
      className="mb-6 border-2 border-white/20 bg-[#111] p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#555] uppercase tracking-widest">Fenomeno em curso</span>
      </div>
      <p className="text-base font-bold text-[#e5e5e5] leading-snug">{metaTrend.theme}</p>
      <p className="text-sm text-[#888] leading-relaxed">{metaTrend.description}</p>
      <div className="space-y-1 pt-3 border-t border-[#1a1a1a]">
        <span className="text-xs text-[#444] uppercase tracking-widest">Oportunidade Overlens</span>
        <p className="text-sm text-[#aaa] leading-relaxed">{metaTrend.overlensOpportunity}</p>
      </div>
      {metaTrend.trendIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {metaTrend.trendIds.map(id => (
            <button
              key={id}
              onClick={() => onScrollToTrend(id)}
              className="px-2 py-0.5 text-xs border border-[#333] text-[#666] hover:text-[#e5e5e5] hover:border-[#555] transition-colors"
            >
              trend #{id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cache helpers that accept profile ─────────────────────────────────────────

async function fetchTrendsForProfile(
  profile: Profile,
): Promise<{ trends: Trend[]; dataTrends: Trend[]; socialTrends: Trend[]; metaTrend?: MetaTrend }> {
  const res = await fetch('/api/trends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar trends')
  return {
    trends: data.trends ?? [],
    dataTrends: data._dataTrends ?? [],
    socialTrends: data._socialTrends ?? [],
    metaTrend: data.metaTrend,
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [result, setResult]           = useState<AnalysisResult | null>(null)
  const [metaTrend, setMetaTrend]     = useState<MetaTrend | null>(null)
  const [fetchedAt, setFetchedAt]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [loadingStep, setLoadingStep] = useState(LOADING_STEPS[0].label)
  const [error, setError]             = useState('')
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [, setTick]                   = useState(0)
  const [filterWindow, setFilterWindow]     = useState<FilterWindow>('TODAS')
  const [filterPlatform, setFilterPlatform] = useState<FilterPlatform>('TODAS')
  const [newCount, setNewCount]       = useState(0)
  const [profile, setProfile]         = useState<Profile>('overlens')

  // Reorder state
  const [reorderMode, setReorderMode]         = useState(false)
  const [orderedTrends, setOrderedTrends]     = useState<Trend[]>([])
  const [hasManualOrder, setHasManualOrder]   = useState(false)
  const [orderChanged, setOrderChanged]       = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  useEffect(() => {
    const cache = loadTrendsCache()
    if (!cache) return
    setResult(cache.result)
    setFetchedAt(cache.fetchedAt)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  // Keep orderedTrends in sync with result
  useEffect(() => {
    if (!result?.trends) return
    const manualOrder = loadManualOrder()
    const allIds = result.trends.map(t => t.id)
    if (manualOrder && manualOrder.every(id => allIds.includes(id)) && allIds.every(id => manualOrder.includes(id))) {
      setOrderedTrends(applyManualOrder(result.trends, manualOrder))
      setHasManualOrder(true)
    } else {
      setOrderedTrends([...result.trends].sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id)))
      setHasManualOrder(false)
    }
  }, [result])

  async function fetchTrends(force = false) {
    const expired = isAnyCacheExpired()
    if (!force && !expired && result) return

    setError('')
    setLoadingStep(LOADING_STEPS[0].label)
    setLoading(true)

    // Schedule step label updates
    loadingTimersRef.current.forEach(clearTimeout)
    loadingTimersRef.current = LOADING_STEPS.slice(1).map(({ ms, label }) =>
      setTimeout(() => setLoadingStep(label), ms)
    )

    try {
      const previous = loadPreviousTrends()
      const { trends, dataTrends, socialTrends, metaTrend: fetchedMetaTrend } = await fetchTrendsForProfile(profile)

      const marked = markNewTrends(trends, previous)
      const count  = marked.filter(t => t.isNew).length

      savePreviousTrends(trends)

      // Persist to local cache
      const { saveSplitCaches } = await import('@/lib/trends-cache')
      const at = saveSplitCaches(dataTrends, socialTrends)

      setResult({ trends: marked })
      setMetaTrend(fetchedMetaTrend ?? null)
      setNewCount(count)
      setFetchedAt(at)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      loadingTimersRef.current.forEach(clearTimeout)
      setLoading(false)
    }
  }

  const expired   = isAnyCacheExpired()
  const hasResult = result?.trends && result.trends.length > 0

  const filteredTrends = orderedTrends.filter(t => {
    if (filterWindow !== 'TODAS' && t.window !== filterWindow) return false
    if (filterPlatform !== 'TODAS') {
      if (!t.platform.toLowerCase().includes(filterPlatform.toLowerCase())) return false
    }
    return true
  })

  // ── Drag and drop handlers ────────────────────────────────────────────────

  function handleDragStart(index: number) {
    dragIndexRef.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    setOrderedTrends(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      dragIndexRef.current = index
      return next
    })
    setOrderChanged(true)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragIndexRef.current = null
  }

  function handleSaveOrder() {
    saveManualOrder(orderedTrends.map(t => t.id))
    setHasManualOrder(true)
    setOrderChanged(false)
    setReorderMode(false)
  }

  function scrollToTrend(id: number) {
    const el = document.getElementById(`trend-card-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleResetOrder() {
    localStorage.removeItem(MANUAL_ORDER_KEY)
    if (result?.trends) {
      setOrderedTrends([...result.trends].sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id)))
    }
    setHasManualOrder(false)
    setOrderChanged(false)
    setReorderMode(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Módulo 2</h1>
        <h2 className="text-xl font-bold">Radar de Trends</h2>
        <p className="text-sm text-[#444] mt-2">
          Identifica o que está subindo no nicho de IA, criatividade e tecnologia.
        </p>
      </div>

      {/* Profile toggle */}
      <div className="flex gap-2 mb-6">
        {(['overlens', 'ruan'] as Profile[]).map(p => (
          <button
            key={p}
            onClick={() => setProfile(p)}
            className={`px-4 py-2 min-h-[44px] text-xs font-medium border transition-colors uppercase tracking-wide touch-manipulation ${
              profile === p
                ? 'border-white text-white'
                : 'border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444]'
            }`}
          >
            {p === 'overlens' ? 'Overlens' : 'Ruan'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-xs text-[#ef4444]">{error}</p>}

      {/* Buscar button */}
      <button
        onClick={() => fetchTrends(expired)}
        disabled={loading}
        className="w-full bg-white text-black py-3 text-sm font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 mb-3"
      >
        {loading ? loadingStep : !hasResult ? 'Buscar trends agora' : expired ? 'Cache expirado — buscar novamente' : 'Buscar trends agora'}
      </button>

      {/* Status do cache */}
      <CacheStatus
        fetchedAt={fetchedAt}
        expired={expired}
        onRefresh={() => fetchTrends(true)}
        className="mb-6"
      />

      {/* Link para histórico */}
      <div className="flex justify-end mb-6">
        <a
          href="/historico/trends"
          className="text-xs text-[#333] hover:text-[#666] transition-colors"
        >
          Histórico de buscas
        </a>
      </div>

      {/* Loading panel com etapas */}
      {loading && <LoadingPanel step={loadingStep} />}

      {/* Resultados */}
      {!loading && hasResult && (
        <>
          {/* Banner de trends novas */}
          {newCount > 0 && (
            <div
              className="mb-5 px-4 py-2.5 text-xs font-medium border"
              style={{ borderColor: '#22c55e40', color: '#22c55e' }}
            >
              {newCount} {newCount === 1 ? 'trend nova' : 'trends novas'} desde a última busca
            </div>
          )}

          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-widest uppercase text-[#444]">Rank de trends</span>
              <div className="flex-1 border-t border-[#1a1a1a] sm:hidden" />
              <span className="text-xs text-[#333]">
                {filteredTrends.length !== result!.trends!.length
                  ? `${filteredTrends.length} de ${result!.trends!.length}`
                  : `${result!.trends!.length} identificadas`
                }
              </span>
            </div>
            <div className="hidden sm:flex sm:flex-1 border-t border-[#1a1a1a]" />
            <div className="flex flex-wrap items-center gap-2">
              <BriefingCopyButton trends={filteredTrends.length > 0 ? filteredTrends : (result!.trends ?? [])} />
              <ExportBar result={result!} type="trends" />
            </div>
          </div>

          {/* Filtros + reordenação */}
          <div className="flex flex-col gap-2 mb-5 pb-4 border-b border-[#1a1a1a]">
            {/* Janela temporal — scroll horizontal no mobile */}
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 whitespace-nowrap">
                {WINDOW_OPTIONS.map(w => (
                  <button
                    key={w}
                    onClick={() => setFilterWindow(w)}
                    className={`px-2.5 py-2 min-h-[44px] text-xs border transition-colors touch-manipulation flex-shrink-0 ${
                      filterWindow === w
                        ? 'border-[#444] text-[#e5e5e5]'
                        : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Plataforma — scroll horizontal no mobile */}
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 whitespace-nowrap">
                {PLATFORM_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPlatform(p)}
                    className={`px-2.5 py-2 min-h-[44px] text-xs border transition-colors touch-manipulation flex-shrink-0 ${
                      filterPlatform === p
                        ? 'border-[#444] text-[#e5e5e5]'
                        : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Reordenação */}
            <div className="flex flex-wrap gap-2 items-center">
              {reorderMode && orderChanged && (
                <button
                  onClick={handleSaveOrder}
                  className="px-2.5 py-2 min-h-[44px] text-xs border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors touch-manipulation"
                >
                  Salvar ordem
                </button>
              )}
              {(hasManualOrder || reorderMode) && (
                <button
                  onClick={handleResetOrder}
                  className="px-2.5 py-2 min-h-[44px] text-xs border border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333] transition-colors touch-manipulation"
                >
                  Resetar
                </button>
              )}
              <button
                onClick={() => { setReorderMode(v => !v); setOrderChanged(false) }}
                className={`px-2.5 py-2 min-h-[44px] text-xs border transition-colors touch-manipulation ${
                  reorderMode
                    ? 'border-[#444] text-[#e5e5e5]'
                    : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                }`}
              >
                Reordenar
              </button>
            </div>
          </div>

          {/* MetaTrend card */}
          {metaTrend && (
            <MetaTrendCard metaTrend={metaTrend} onScrollToTrend={scrollToTrend} />
          )}

          {/* Cards */}
          <div className="space-y-3">
            {filteredTrends.length > 0
              ? filteredTrends.map((trend, index) => (
                  reorderMode
                    ? (
                      <div
                        key={trend.id}
                        id={`trend-card-${trend.id}`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={e => handleDragOver(e, index)}
                        onDrop={handleDrop}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <TrendCard
                          trend={trend}
                          fetchedAt={fetchedAt ?? undefined}
                          dragHandle={
                            <GripVertical size={14} className="text-[#444] cursor-grab" />
                          }
                        />
                      </div>
                    )
                    : (
                      <div key={trend.id} id={`trend-card-${trend.id}`}>
                        <TrendCard trend={trend} fetchedAt={fetchedAt ?? undefined} />
                      </div>
                    )
                ))
              : <p className="text-xs text-[#444] py-4">Nenhuma trend com esses filtros.</p>
            }
          </div>

          {/* Formatos em alta */}
          {result!.trends && result!.trends.length > 0 && (
            <FormatsSection trends={result!.trends} />
          )}
        </>
      )}
    </div>
  )
}
