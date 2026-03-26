'use client'

import { useState, useEffect } from 'react'
import type { SavedTrend, PerformanceData } from '@/types'
import { getSavedTrends, updateTrendStatus, savePerformanceData, getPerformanceStats } from '@/lib/saved-trends'
import Link from 'next/link'

const STATUS_LABELS: Record<SavedTrend['status'], string> = {
  salva: 'Salvas',
  gravando: 'Gravando',
  publicada: 'Publicadas',
}

const STATUS_ORDER: SavedTrend['status'][] = ['salva', 'gravando', 'publicada']

const STATUS_NEXT: Record<SavedTrend['status'], SavedTrend['status'] | null> = {
  salva: 'gravando',
  gravando: 'publicada',
  publicada: null,
}

const STATUS_COLORS: Record<SavedTrend['status'], string> = {
  salva: '#555',
  gravando: '#eab308',
  publicada: '#22c55e',
}

const ENGAGEMENT_COLORS: Record<PerformanceData['engagement'], string> = {
  acima: '#22c55e',
  esperado: '#eab308',
  abaixo: '#ef4444',
}

const ENGAGEMENT_LABELS: Record<PerformanceData['engagement'], string> = {
  acima: 'acima',
  esperado: 'esperado',
  abaixo: 'abaixo',
}

// ── Performance Modal ─────────────────────────────────────────────────────────

function PerformanceModal({
  item,
  onSave,
  onSkip,
}: {
  item: SavedTrend
  onSave: (id: string, data: PerformanceData) => void
  onSkip: () => void
}) {
  const [platform, setPlatform] = useState('Instagram Reels')
  const [views24h, setViews24h] = useState('')
  const [engagement, setEngagement] = useState<PerformanceData['engagement']>('esperado')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const data: PerformanceData = {
      platform,
      engagement,
      recordedAt: new Date().toISOString(),
      ...(views24h ? { views24h: Number(views24h) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    onSave(item.id, data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] w-full max-w-sm mx-4 p-5 space-y-4">
        <div>
          <p className="text-xs text-[#444] uppercase tracking-widest mb-1">Registrar resultado</p>
          <p className="text-sm text-[#e5e5e5] font-medium leading-snug">{item.trend.superficialSubject}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-[#555] uppercase tracking-wide">Plataforma</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#e5e5e5] px-3 py-2 focus:outline-none focus:border-[#333]"
            >
              <option>Instagram Reels</option>
              <option>TikTok</option>
              <option>YouTube Shorts</option>
              <option>outra</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#555] uppercase tracking-wide">Views nas primeiras 24h (opcional)</label>
            <input
              type="number"
              value={views24h}
              onChange={e => setViews24h(e.target.value)}
              placeholder="ex: 15000"
              min="0"
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#e5e5e5] px-3 py-2 focus:outline-none focus:border-[#333] placeholder-[#333]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#555] uppercase tracking-wide">Engajamento</label>
            <div className="flex gap-2">
              {(['abaixo', 'esperado', 'acima'] as PerformanceData['engagement'][]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setEngagement(opt)}
                  className="flex-1 py-1.5 text-xs border transition-colors"
                  style={
                    engagement === opt
                      ? { borderColor: ENGAGEMENT_COLORS[opt], color: ENGAGEMENT_COLORS[opt] }
                      : { borderColor: '#1a1a1a', color: '#444' }
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#555] uppercase tracking-wide">Observação (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 280))}
              rows={3}
              placeholder="Anote aprendizados, contexto, o que funcionou..."
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#e5e5e5] px-3 py-2 focus:outline-none focus:border-[#333] placeholder-[#333] resize-none"
            />
            <p className="text-[10px] text-[#333] text-right">{notes.length}/280</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-xs font-medium bg-white text-black hover:bg-[#e5e5e5] transition-colors disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Salvar resultado'}
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-xs border border-[#1a1a1a] text-[#444] hover:text-[#e5e5e5] hover:border-[#333] transition-colors"
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stats panel ───────────────────────────────────────────────────────────────

function StatsPanel({ items }: { items: SavedTrend[] }) {
  const stats = getPerformanceStats(items)
  if (stats.total === 0) return null

  const pct = Math.round((stats.acima / stats.total) * 100)

  return (
    <div className="mb-6 border border-[#1a1a1a] px-4 py-3 flex flex-wrap gap-4 items-center">
      <div>
        <span className="text-xs text-[#444] uppercase tracking-widest">Publicadas com resultado</span>
        <p className="text-sm text-[#e5e5e5] font-medium mt-0.5">
          {stats.total} publicada{stats.total !== 1 ? 's' : ''}
          {stats.acima > 0 && (
            <span className="ml-2 text-[#22c55e]">— {stats.acima} acima do esperado ({pct}%)</span>
          )}
        </p>
      </div>
      <div className="flex gap-3 ml-auto text-xs">
        <span style={{ color: '#22c55e' }}>{stats.acima} acima</span>
        <span style={{ color: '#eab308' }}>{stats.esperado} esperado</span>
        <span style={{ color: '#ef4444' }}>{stats.abaixo} abaixo</span>
        {stats.avgViews > 0 && (
          <span className="text-[#555]">~{stats.avgViews.toLocaleString('pt-BR')} views médias</span>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ProfileFilter = 'todas' | 'ruan' | 'overlens'

export default function SavedPage() {
  const [items, setItems]   = useState<SavedTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPublish, setPendingPublish] = useState<SavedTrend | null>(null)
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>('todas')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    getSavedTrends().then(data => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  async function handleStatusChange(id: string, newStatus: SavedTrend['status']) {
    const item = items.find(i => i.id === id)
    if (newStatus === 'publicada' && item) {
      // First update status, then show modal
      await updateTrendStatus(id, newStatus)
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i))
      setPendingPublish(items.find(i => i.id === id) ?? null)
    } else {
      await updateTrendStatus(id, newStatus)
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i))
    }
  }

  async function handlePerformanceSave(id: string, data: PerformanceData) {
    await savePerformanceData(id, data)
    setItems(prev => prev.map(i => i.id === id ? { ...i, performanceData: data } : i))
    setPendingPublish(null)
  }

  const filteredItems = items
    .filter(i => profileFilter === 'todas' || i.profile === profileFilter)
    .filter(i => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        i.trend.superficialSubject.toLowerCase().includes(q) ||
        (i.trend.hookAngle ?? '').toLowerCase().includes(q) ||
        i.trend.platform.toLowerCase().includes(q)
      )
    })

  const byStatus = STATUS_ORDER.map(status => ({
    status,
    label: STATUS_LABELS[status],
    items: filteredItems.filter(i => i.status === status),
  }))

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {pendingPublish && (
        <PerformanceModal
          item={pendingPublish}
          onSave={handlePerformanceSave}
          onSkip={() => setPendingPublish(null)}
        />
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Trends</h1>
          <h2 className="text-xl font-bold">Salvas</h2>
        </div>
        <Link href="/trends" className="text-xs text-[#444] hover:text-[#e5e5e5] transition-colors">
          Voltar para Radar
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por assunto, plataforma..."
          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#e5e5e5] px-3 py-2.5 focus:outline-none focus:border-[#333] placeholder-[#333] transition-colors"
        />
      </div>

      <div className="flex gap-2 mb-6">
        {(['todas', 'overlens', 'ruan'] as ProfileFilter[]).map(p => (
          <button
            key={p}
            onClick={() => setProfileFilter(p)}
            className={`px-3 py-1.5 text-xs border transition-colors uppercase tracking-wide ${
              profileFilter === p
                ? 'border-[#444] text-[#e5e5e5]'
                : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
            }`}
          >
            {p === 'todas' ? 'Todas' : p === 'overlens' ? 'Overlens' : 'Ruan'}
          </button>
        ))}
      </div>

      {!loading && <StatsPanel items={filteredItems} />}

      {loading && (
        <p className="text-xs text-[#444]">Carregando...</p>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="text-sm text-[#444]">
          Nenhuma trend salva ainda.{' '}
          <Link href="/trends" className="text-[#e5e5e5] underline">Ir para o Radar</Link>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {byStatus.map(({ status, label, items: col }) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs uppercase tracking-widest" style={{ color: STATUS_COLORS[status] }}>
                  {label}
                </span>
                <span className="text-xs text-[#333]">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map(item => (
                  <SavedTrendItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {col.length === 0 && (
                  <p className="text-xs text-[#2a2a2a] py-2">Vazio</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SavedTrendItem({
  item,
  onStatusChange,
}: {
  item: SavedTrend
  onStatusChange: (id: string, status: SavedTrend['status']) => void
}) {
  const nextStatus = STATUS_NEXT[item.status]
  const color = STATUS_COLORS[item.status]
  const pd = item.performanceData

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#e5e5e5] leading-snug">{item.trend.superficialSubject}</p>
          <p className="text-xs text-[#444] mt-0.5">{item.trend.platform}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 border"
            style={{ color, borderColor: color + '40' }}
          >
            {item.trend.window}
          </span>
          {pd && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 border"
              style={{ color: ENGAGEMENT_COLORS[pd.engagement], borderColor: ENGAGEMENT_COLORS[pd.engagement] + '40' }}
            >
              {ENGAGEMENT_LABELS[pd.engagement]}
            </span>
          )}
        </div>
      </div>

      {item.trend.hookAngle && (
        <p className="text-xs text-[#666] italic">"{item.trend.hookAngle}"</p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-[#111]">
        <span className="text-[10px] text-[#333]">
          {new Date(item.savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(item.id, nextStatus)}
            className="text-[10px] px-2 py-0.5 border border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444] transition-colors"
          >
            {nextStatus === 'gravando' ? 'Gravar' : 'Publicar'}
          </button>
        )}
      </div>
    </div>
  )
}
