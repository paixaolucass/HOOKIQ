'use client'

import { useState, useEffect, useRef } from 'react'
import { AnalysisResult, Trend, TrendWindow, MetaTrend } from '@/types'
import TrendCard from '@/components/TrendCard'
import ExportBar from '@/components/ExportBar'
import CacheStatus from '@/components/CacheStatus'
import { ChevronDown, ChevronUp, Copy, Check, GripVertical } from 'lucide-react'

import {
  loadMergedCacheResult,
  isAnyCacheExpired,
  loadDataCache,
  loadSocialCache,
} from '@/lib/trends-cache'
import { LOADING_STEPS } from '@/lib/loading-steps'
import { playDone } from '@/lib/sound'
import { notifyDone } from '@/lib/notify'
import Toast from '@/components/Toast'

// ── localStorage keys ─────────────────────────────────────────────────────────

const PREVIOUS_KEY = 'hookiq_trends_previous'
const MANUAL_ORDER_KEY = 'hookiq_trends_manual_order'

type FilterWindow   = TrendWindow | 'TODAS'
type FilterPlatform = 'TODAS' | 'Google Trends' | 'YouTube Shorts' | 'TikTok' | 'Instagram' | 'Hacker News' | 'Reddit'
type FilterOrigin   = 'TODAS' | 'Brasil' | 'EUA' | 'Global' | 'Europa'
type Profile = 'ruan' | 'overlens'

const WINDOW_OPTIONS:   FilterWindow[]   = ['TODAS', 'ABERTA', 'FECHANDO', 'FECHADA']
const PLATFORM_OPTIONS: FilterPlatform[] = ['TODAS', 'Google Trends', 'YouTube Shorts', 'TikTok', 'Instagram', 'Hacker News', 'Reddit']
const ORIGIN_OPTIONS:   FilterOrigin[]   = ['TODAS', 'Brasil', 'EUA', 'Global', 'Europa']

const ORIGIN_LABELS: Record<FilterOrigin, string> = {
  TODAS:  'Todas origens',
  Brasil: '🇧🇷 BR',
  EUA:    '🇺🇸 EUA',
  Global: '🌐 Global',
  Europa: '🇪🇺 Europa',
}

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

// ── Ignored trends helpers ────────────────────────────────────────────────────

function ignoredKey(profile: Profile) { return `hookiq_ignored_${profile}` }

function loadIgnored(profile: Profile): string[] {
  try {
    const raw = localStorage.getItem(ignoredKey(profile))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveIgnored(profile: Profile, subjects: string[]) {
  localStorage.setItem(ignoredKey(profile), JSON.stringify(subjects))
}

function getSignificantWordsIgnore(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
}

function isIgnored(trend: Trend, ignoredSubjects: string[]): boolean {
  if (ignoredSubjects.length === 0) return false
  const wordsA = getSignificantWordsIgnore(trend.superficialSubject)
  for (const subject of ignoredSubjects) {
    const wordsB = getSignificantWordsIgnore(subject)
    const common = wordsA.filter(w => wordsB.includes(w))
    if (common.length >= 2) return true
  }
  return false
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

// ── Cache explainer modal ─────────────────────────────────────────────────────

function CacheExplainer() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mb-6 w-full text-left px-4 py-3 border border-[#1a1a1a] bg-[#0d0d0d] hover:bg-[#111] hover:border-[#2a2a2a] transition-colors group"
      >
        <span className="text-sm font-medium text-[#888] group-hover:text-[#e5e5e5] transition-colors">
          Entenda o que são os caches
        </span>
        <span className="ml-2 text-xs text-[#444] group-hover:text-[#666] transition-colors">→</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0d0d0d] border border-[#2a2a2a] w-full max-w-lg p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-bold text-[#e5e5e5]">O que é o cache?</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[#444] hover:text-[#e5e5e5] transition-colors text-lg leading-none flex-shrink-0"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-[#888] leading-relaxed">
              Toda vez que você clica em <strong className="text-[#e5e5e5]">Buscar trends</strong>, o sistema consulta 9 fontes de dados (Google Trends, YouTube, Reddit, Hacker News, arXiv, e mais) e manda tudo para uma IA analisar. Esse processo leva até 40 segundos e consome créditos de API.
            </p>

            <p className="text-sm text-[#888] leading-relaxed">
              O <strong className="text-[#e5e5e5]">cache</strong> é uma cópia salva do último resultado. Em vez de repetir toda essa operação a cada clique, o sistema guarda o resultado e reutiliza enquanto ainda é relevante. Assim a resposta é instantânea e você não desperdiça crédito.
            </p>

            <div className="border border-[#1a1a1a] divide-y divide-[#1a1a1a]">
              <div className="px-4 py-3 flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-xs text-[#555] uppercase tracking-wide pt-0.5">Cache dados</div>
                <div>
                  <p className="text-sm text-[#e5e5e5] font-medium">12 horas</p>
                  <p className="text-xs text-[#666] mt-0.5">Trends vindos de fontes abertas: Google, YouTube, Reddit, HN, arXiv, Dev.to. Mudam pouco ao longo do dia.</p>
                </div>
              </div>
              <div className="px-4 py-3 flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-xs text-[#555] uppercase tracking-wide pt-0.5">Cache social</div>
                <div>
                  <p className="text-sm text-[#e5e5e5] font-medium">24 horas</p>
                  <p className="text-xs text-[#666] mt-0.5">Trends de TikTok e Instagram buscadas em tempo real pela IA. Mudam mais rápido, então expiram em menos tempo.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-[#555] uppercase tracking-wide">O que aparece no indicador de cache</p>
              <div className="space-y-1.5 text-xs text-[#666]">
                <p><span className="text-[#22c55e]">Verde</span> — cache válido. Os dados foram buscados há pouco e o sistema está usando o resultado salvo.</p>
                <p><span className="text-[#ef4444]">Vermelho</span> — cache expirado. A próxima busca vai buscar dados frescos.</p>
                <p><span className="text-[#444]">Sem indicador</span> — nenhuma busca foi feita ainda para esse perfil neste dispositivo.</p>
              </div>
            </div>

            <p className="text-xs text-[#444]">
              O cache é separado por perfil — Overlens e Ruan têm resultados independentes.
            </p>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2.5 text-sm font-medium bg-white text-black hover:bg-[#e5e5e5] transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
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
  const [cacheInfoMap, setCacheInfoMap] = useState<Record<string, { data: string | null; social: string | null }>>({
    overlens: { data: null, social: null },
    ruan:     { data: null, social: null },
  })
  const [loading, setLoading]         = useState(false)
  const [loadingStep, setLoadingStep] = useState(LOADING_STEPS[0].label)
  const [error, setError]             = useState('')
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [, setTick]                   = useState(0)
  const [filterWindow, setFilterWindow]     = useState<FilterWindow>('TODAS')
  const [filterPlatform, setFilterPlatform] = useState<FilterPlatform>('TODAS')
  const [filterOrigin, setFilterOrigin]     = useState<FilterOrigin>('TODAS')
  const [newCount, setNewCount]       = useState(0)
  const [profile, setProfile]         = useState<Profile>(() => {
    if (typeof window === 'undefined') return 'overlens'
    return (localStorage.getItem('hookiq_profile') as Profile) ?? 'overlens'
  })
  const [toast, setToast]             = useState(false)

  // Ignored trends
  const [ignoredSubjects, setIgnoredSubjects] = useState<string[]>([])

  // Reorder state
  const [reorderMode, setReorderMode]         = useState(false)
  const [orderedTrends, setOrderedTrends]     = useState<Trend[]>([])
  const [hasManualOrder, setHasManualOrder]   = useState(false)
  const [orderChanged, setOrderChanged]       = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  useEffect(() => {
    setIgnoredSubjects(loadIgnored(profile))
    const cached = loadMergedCacheResult(profile)
    // Always update result — clear if no cache for this profile
    setResult(cached)
    const dataEntry   = loadDataCache(profile)
    const socialEntry = loadSocialCache(profile)
    setCacheInfoMap(prev => ({ ...prev, [profile]: { data: dataEntry?.fetchedAt ?? null, social: socialEntry?.fetchedAt ?? null } }))
  }, [profile])

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
    const expired = isAnyCacheExpired(profile)
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
      const { saveSplitCaches, loadDataCache: ldc, loadSocialCache: lsc } = await import('@/lib/trends-cache')
      saveSplitCaches(dataTrends, socialTrends, profile)
      const dataEntry2   = ldc(profile)
      const socialEntry2 = lsc(profile)

      setResult({ trends: marked })
      setMetaTrend(fetchedMetaTrend ?? null)
      setNewCount(count)
      setCacheInfoMap(prev => ({ ...prev, [profile]: { data: dataEntry2?.fetchedAt ?? null, social: socialEntry2?.fetchedAt ?? null } }))
      playDone()
      setToast(true)
      notifyDone('Trends prontas', `${marked.length} trends identificadas para ${profile === 'overlens' ? 'Overlens' : 'Ruan'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      loadingTimersRef.current.forEach(clearTimeout)
      setLoading(false)
    }
  }

  const expired   = isAnyCacheExpired(profile)
  const hasResult = result?.trends && result.trends.length > 0

  const visibleTrends = orderedTrends.filter(t => !isIgnored(t, ignoredSubjects))
  const ignoredCount  = orderedTrends.length - visibleTrends.length

  const filteredTrends = visibleTrends.filter(t => {
    if (filterWindow !== 'TODAS' && t.window !== filterWindow) return false
    if (filterPlatform !== 'TODAS') {
      if (!t.platform.toLowerCase().includes(filterPlatform.toLowerCase())) return false
    }
    if (filterOrigin !== 'TODAS') {
      if ((t.originCountry ?? 'EUA') !== filterOrigin) return false
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

  function handleIgnore(trend: Trend) {
    const next = [...ignoredSubjects, trend.superficialSubject]
    setIgnoredSubjects(next)
    saveIgnored(profile, next)
  }

  function handleRestoreIgnored() {
    setIgnoredSubjects([])
    saveIgnored(profile, [])
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
      {toast && <Toast message="Trends prontas" onDone={() => setToast(false)} />}
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
            onClick={() => { setProfile(p); setError(''); localStorage.setItem('hookiq_profile', p) }}
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
        dataFetchedAt={cacheInfoMap[profile].data}
        socialFetchedAt={cacheInfoMap[profile].social}
        expired={expired}
        onRefresh={() => fetchTrends(true)}
        className="mb-3"
      />

      {/* Cache explanation */}
      <CacheExplainer />

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
                {filteredTrends.length !== visibleTrends.length
                  ? `${filteredTrends.length} de ${visibleTrends.length}`
                  : `${visibleTrends.length} identificadas`
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

            {/* Origem */}
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 whitespace-nowrap">
                {ORIGIN_OPTIONS.map(o => (
                  <button
                    key={o}
                    onClick={() => setFilterOrigin(o)}
                    className={`px-2.5 py-2 min-h-[44px] text-xs border transition-colors touch-manipulation flex-shrink-0 ${
                      filterOrigin === o
                        ? 'border-[#444] text-[#e5e5e5]'
                        : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                    }`}
                  >
                    {ORIGIN_LABELS[o]}
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
                          fetchedAt={cacheInfoMap[profile].data ?? cacheInfoMap[profile].social ?? undefined}
                          profile={profile}
                          dragHandle={
                            <GripVertical size={14} className="text-[#444] cursor-grab" />
                          }
                        />
                      </div>
                    )
                    : (
                      <div key={trend.id} id={`trend-card-${trend.id}`}>
                        <TrendCard
                          trend={trend}
                          fetchedAt={cacheInfoMap[profile].data ?? cacheInfoMap[profile].social ?? undefined}
                          profile={profile}
                          onIgnore={() => handleIgnore(trend)}
                        />
                      </div>
                    )
                ))
              : <p className="text-xs text-[#444] py-4">Nenhuma trend com esses filtros.</p>
            }
          </div>

          {/* Trends ignoradas */}
          {ignoredCount > 0 && (
            <div className="mt-4 flex items-center gap-3 text-xs">
              <span className="text-[#333]">
                {ignoredCount} trend{ignoredCount !== 1 ? 's' : ''} ignorada{ignoredCount !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleRestoreIgnored}
                className="text-[#444] hover:text-[#e5e5e5] underline transition-colors"
              >
                restaurar
              </button>
            </div>
          )}

          {/* Formatos em alta */}
          {result!.trends && result!.trends.length > 0 && (
            <FormatsSection trends={result!.trends} />
          )}
        </>
      )}
    </div>
  )
}
