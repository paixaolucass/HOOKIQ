'use client'

import { useState, useEffect } from 'react'
import { Trend, TrendRhetoric, SaturationEstimate, TrendComment, TrendAssignment } from '@/types'
import { ChevronDown, ChevronUp, Copy, Check, Bookmark, BookmarkCheck, Clock } from 'lucide-react'
import { saveTrend } from '@/lib/saved-trends'
import { addComment, getComments, assignTrend, getAssignment } from '@/lib/trend-comments'

const windowConfig = {
  ABERTA:   { color: '#22c55e', label: 'ABERTA',   time: '0–2 dias de crescimento' },
  FECHANDO: { color: '#eab308', label: 'FECHANDO', time: '3–5 dias — entre com ângulo diferente' },
  FECHADA:  { color: '#ef4444', label: 'FECHADA',  time: '6+ dias — apenas ângulo completamente novo' },
}

function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-3 h-1" style={{ background: i < value ? '#e5e5e5' : '#222' }} />
      ))}
    </div>
  )
}

const competitorColors: Record<SaturationEstimate['competitorVolume'], string> = {
  baixo: '#22c55e',
  médio: '#eab308',
  alto:  '#ef4444',
}

const recommendationColors: Record<SaturationEstimate['recommendation'], string> = {
  'entrar agora':              '#22c55e',
  'entrar com ângulo diferente': '#eab308',
  'evitar':                    '#ef4444',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className="ml-1.5 p-0.5 text-[#333] hover:text-[#888] transition-colors flex-shrink-0"
    >
      {copied
        ? <Check size={11} className="text-[#22c55e]" />
        : <Copy size={11} />
      }
    </button>
  )
}

function SaturationBlock({ sat }: { sat: SaturationEstimate }) {
  return (
    <div className="space-y-2 pt-4 border-t border-[#111]">
      <div className="text-xs text-[#333] uppercase tracking-widest">Saturação</div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-0.5">
          <span className="text-xs text-[#444]">Dias restantes</span>
          <p className="text-sm font-mono font-bold text-[#e5e5e5]">{sat.daysRemaining}d</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs text-[#444]">Volume concorrentes</span>
          <p className="text-xs font-bold uppercase" style={{ color: competitorColors[sat.competitorVolume] }}>
            {sat.competitorVolume}
          </p>
        </div>
        <div className="space-y-0.5">
          <span className="text-xs text-[#444]">Recomendação</span>
          <p className="text-xs font-bold uppercase" style={{ color: recommendationColors[sat.recommendation] }}>
            {sat.recommendation}
          </p>
        </div>
      </div>
    </div>
  )
}

function RhetoricalBlock({ rhetoric }: { rhetoric: TrendRhetoric }) {
  return (
    <div className="space-y-4 pt-4 border-t border-[#111]">
      <div className="text-xs text-[#333] uppercase tracking-widest">Retórica do formato</div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#e5e5e5]">ETHOS</span>
          <MiniBar value={rhetoric.ethos.score} />
          <span className="text-xs text-[#444]">{rhetoric.ethos.score}/2 — autoridade</span>
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetoric.ethos.analysis}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[#e5e5e5]">PATHOS</span>
          <MiniBar value={rhetoric.pathos.score} />
          <span className="text-xs text-[#444]">{rhetoric.pathos.score}/2</span>
          {rhetoric.pathos.emotion && (
            <span className="text-xs text-[#eab308] border border-[#eab308]/30 px-1.5 py-0.5">{rhetoric.pathos.emotion}</span>
          )}
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetoric.pathos.analysis}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#e5e5e5]">LOGOS</span>
          <MiniBar value={rhetoric.logos.score} />
          <span className="text-xs text-[#444]">{rhetoric.logos.score}/2 — convicção lógica</span>
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetoric.logos.analysis}</p>
      </div>
    </div>
  )
}

function ConfidenceBadge({ rhetoric }: { rhetoric: TrendRhetoric }) {
  const confidence = Math.round(((rhetoric.ethos.score + rhetoric.pathos.score + rhetoric.logos.score) / 6) * 100)
  const color = confidence >= 70 ? '#22c55e' : confidence >= 40 ? '#eab308' : '#ef4444'
  return (
    <span
      className="text-xs font-mono px-1.5 py-0.5 border"
      style={{ color, borderColor: color + '40' }}
    >
      conf. {confidence}%
    </span>
  )
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

// ── Assignment selector ───────────────────────────────────────────────────────

function AssignmentSelector({
  trendId,
  fetchedAt,
}: {
  trendId: number
  fetchedAt: string
}) {
  const [assignment, setAssignment] = useState<TrendAssignment>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!fetchedAt) return
    getAssignment(trendId, fetchedAt).then(a => {
      setAssignment(a)
      setLoaded(true)
    })
  }, [trendId, fetchedAt])

  async function handleClick(e: React.MouseEvent, value: TrendAssignment) {
    e.stopPropagation()
    if (!fetchedAt) return
    const next = assignment === value ? null : value
    setAssignment(next)
    await assignTrend(trendId, fetchedAt, next)
  }

  if (!loaded || !fetchedAt) return null

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {(['ruan', 'overlens'] as const).map(val => {
        const active = assignment === val
        return (
          <button
            key={val}
            onClick={e => handleClick(e, val)}
            title={val === 'ruan' ? 'Atribuir a Ruan' : 'Atribuir a Overlens'}
            className="px-2 min-w-[36px] min-h-[36px] text-[10px] font-bold border transition-colors leading-none touch-manipulation flex items-center justify-center"
            style={
              active
                ? { background: '#e5e5e5', color: '#0a0a0a', borderColor: '#e5e5e5' }
                : { background: 'transparent', color: '#444', borderColor: '#2a2a2a' }
            }
          >
            {val === 'ruan' ? 'R' : 'O'}
          </button>
        )
      })}
    </div>
  )
}

// ── Comments section ──────────────────────────────────────────────────────────

function CommentsSection({
  trendId,
  fetchedAt,
}: {
  trendId: number
  fetchedAt: string
}) {
  const [comments, setComments] = useState<TrendComment[]>([])
  const [loaded, setLoaded]     = useState(false)
  const [text, setText]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!fetchedAt) return
    getComments(trendId, fetchedAt).then(data => {
      setComments(data)
      setLoaded(true)
    })
  }, [trendId, fetchedAt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !fetchedAt || submitting) return
    setSubmitting(true)
    try {
      await addComment(trendId, fetchedAt, text.trim())
      // Re-fetch to get the new comment with server data
      const updated = await getComments(trendId, fetchedAt)
      setComments(updated)
      setText('')
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-[#111]">
      <span className="text-xs text-[#333] uppercase tracking-widest">Comentários</span>

      {loaded && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555]">{c.userEmail}</span>
                <span className="text-[10px] text-[#333]">{relativeTime(c.createdAt)}</span>
              </div>
              <p className="text-xs text-[#aaa] leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {loaded && comments.length === 0 && (
        <p className="text-[10px] text-[#333]">Nenhum comentário ainda.</p>
      )}

      {!loaded && (
        <p className="text-[10px] text-[#333]">Carregando...</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-1 sm:flex-row">
        <input
          value={text}
          onChange={e => setText(e.target.value.slice(0, 280))}
          placeholder="Adicionar comentário..."
          className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] text-xs text-[#e5e5e5] px-3 py-2 focus:outline-none focus:border-[#333] placeholder-[#333] min-h-[44px]"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="px-3 py-2 min-h-[44px] text-xs border border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444] transition-colors disabled:opacity-40 touch-manipulation sm:w-auto w-full"
        >
          Comentar
        </button>
      </form>
    </div>
  )
}

// ── TrendCard ─────────────────────────────────────────────────────────────────

export default function TrendCard({
  trend,
  dragHandle,
  fetchedAt,
  profile,
  onIgnore,
}: {
  trend: Trend
  dragHandle?: React.ReactNode
  fetchedAt?: string
  profile?: 'ruan' | 'overlens'
  onIgnore?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const config = windowConfig[trend.window]

  // fetchedAt from prop or fallback from localStorage (for backwards compatibility)
  const resolvedFetchedAt = fetchedAt ?? (typeof window !== 'undefined'
    ? (() => {
        try {
          const raw = localStorage.getItem('hookiq_trends_cache')
          if (!raw) return ''
          const parsed = JSON.parse(raw)
          return parsed.fetchedAt ?? ''
        } catch { return '' }
      })()
    : '')

  const rankColor = (trend.rankScore ?? 0) >= 8
    ? '#22c55e'
    : (trend.rankScore ?? 0) >= 6
      ? '#eab308'
      : '#555'

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (saved || saving) return
    setSaving(true)
    try {
      await saveTrend(trend, profile)
      setSaved(true)
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFromExpanded(e: React.MouseEvent) {
    e.stopPropagation()
    if (saved) return
    if (saving) return
    setSaving(true)
    try {
      await saveTrend(trend, profile)
      setSaved(true)
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">

      {/* Header clicável */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Top row: drag handle + rank + badges */}
          <div className="flex items-start gap-3 flex-wrap min-w-0">
            {/* Drag handle (rendered by parent when in reorder mode) */}
            {dragHandle && (
              <div className="flex-shrink-0 pt-1" onClick={e => e.stopPropagation()}>
                {dragHandle}
              </div>
            )}
            {/* Rank */}
            {trend.rank != null && (
              <div className="flex items-baseline gap-0.5 flex-shrink-0">
                <span className="text-2xl font-bold tabular-nums" style={{ color: rankColor }}>
                  #{trend.rank}
                </span>
                {trend.rankScore != null && (
                  <span className="text-xs text-[#333] ml-1">{trend.rankScore}/10</span>
                )}
                {trend.isNew && (
                  <span
                    className="ml-2 px-1.5 py-0.5 text-[10px] font-bold tracking-widest leading-none"
                    style={{ background: '#22c55e', color: '#000' }}
                  >
                    NOVA
                  </span>
                )}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-xs font-bold px-2 py-0.5 border flex-shrink-0"
                  style={{ color: config.color, borderColor: config.color + '40' }}
                >
                  {config.label}
                </span>
                <span className="text-xs text-[#444] break-words">
                  {trend.platform}
                  {trend.originCountry && trend.originCountry !== 'Brasil' && (
                    <span className="text-[#333]"> · detectada fora do BR</span>
                  )}
                </span>
                {/* Origin country badge */}
                {trend.originCountry && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 flex-shrink-0"
                    style={{
                      background: trend.originCountry === 'Brasil' ? '#166534' : trend.originCountry === 'EUA' ? '#1e3a5f' : '#2d2d2d',
                      color: '#fff',
                    }}
                  >
                    {trend.originCountry === 'EUA' ? '🇺🇸 EUA' : trend.originCountry === 'Brasil' ? '🇧🇷 BR' : trend.originCountry === 'Europa' ? '🇪🇺 EU' : '🌐 Global'}
                  </span>
                )}
                {/* Profile badge */}
                {trend.profile && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 flex-shrink-0 border"
                    style={
                      trend.profile === 'ruan'
                        ? { color: '#fff', borderColor: '#555', background: '#111' }
                        : { color: '#000', borderColor: '#fff', background: '#fff' }
                    }
                  >
                    {trend.profile === 'ruan' ? 'RUAN' : 'OVERLENS'}
                  </span>
                )}
                {/* Confidence badge — only when rhetoric data is present */}
                {trend.rhetoric && <ConfidenceBadge rhetoric={trend.rhetoric} />}
                {/* Seasonal connection badge */}
                {trend.seasonalConnection && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 border flex-shrink-0"
                    style={{ color: '#f97316', borderColor: '#f9731640' }}
                  >
                    {'📅 '}{trend.seasonalConnection.split(' — ')[0]}
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: config.color + 'aa' }}>{config.time}</p>
            </div>
          </div>
          {/* Actions row */}
          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:mt-1">
            {/* Ignore button */}
            {onIgnore && (
              <button
                onClick={e => { e.stopPropagation(); onIgnore() }}
                title="Ignorar esta trend"
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#2a2a2a] hover:text-[#ef4444] transition-colors touch-manipulation"
              >
                <span className="text-base leading-none">×</span>
              </button>
            )}
            {/* Assignment selector */}
            {resolvedFetchedAt && (
              <AssignmentSelector trendId={trend.id} fetchedAt={resolvedFetchedAt} />
            )}
            <button
              onClick={handleSave}
              title={saved ? 'Trend salva' : 'Salvar trend'}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors touch-manipulation"
              style={{ color: saved ? '#22c55e' : '#333' }}
            >
              {saved
                ? <BookmarkCheck size={13} />
                : <Bookmark size={13} />
              }
            </button>
            <span className="text-xs text-[#444] hidden sm:inline">{expanded ? 'fechar' : 'detalhes'}</span>
            {expanded
              ? <ChevronUp size={12} className="text-[#333]" />
              : <ChevronDown size={12} className="text-[#333]" />
            }
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-xs text-[#333] uppercase tracking-wide">Assunto</span>
            <p className="text-sm text-[#aaa] mt-0.5">{trend.superficialSubject}</p>
          </div>
          <div>
            <span className="text-xs text-[#333] uppercase tracking-wide">Formato real</span>
            <p className="text-sm text-[#e5e5e5] mt-0.5">{trend.realFormat}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-[#1a1a1a] mt-3">
          <p className="text-xs" style={{ color: config.color }}>⚡ {trend.urgency}</p>
        </div>
      </div>

      {/* Painel expandido */}
      {expanded && (
        <div
          className="border-t border-[#111] px-5 pb-5 space-y-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Ângulo — label muda por perfil */}
          <div className="pt-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#333] uppercase tracking-wide">
                {trend.profile === 'ruan' ? 'Ângulo Ruan' : 'Ângulo Overlens'}
              </span>
              {trend.profile && (
                <span className="text-[10px] text-[#333]">
                  — adaptado para o perfil {trend.profile === 'ruan' ? 'Ruan' : 'Overlens'}
                </span>
              )}
            </div>
            <p className="text-sm text-[#aaa] leading-relaxed">{trend.overlensAngle}</p>
          </div>

          {/* Justificativa do rank */}
          {trend.rankJustification && (
            <div className="space-y-1">
              <span className="text-xs text-[#333] uppercase tracking-wide">Por que #{trend.rank}</span>
              <p className="text-xs text-[#666] leading-relaxed">{trend.rankJustification}</p>
            </div>
          )}

          {/* Hook angles — multi-option (new) or single fallback (cache antigo) */}
          {trend.hookAngles && trend.hookAngles.length > 0 ? (
            <div className="space-y-2 pt-4 border-t border-[#111]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#333] uppercase tracking-widest">
                  {trend.profile === 'ruan' ? 'Ganchos — estilo Ruan' : 'Ganchos — estilo Overlens'}
                </span>
                {trend.profile && (
                  <span className="text-[10px] text-[#222]">
                    {trend.profile === 'ruan' ? '(curto, impacto imediato)' : '(autoridade, assertivo)'}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {trend.hookAngles.map((angle, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 border border-[#1a1a1a] px-3 py-2"
                  >
                    <span className="text-xs font-mono text-[#444] flex-shrink-0 mt-0.5 w-4">{idx + 1}</span>
                    <p className="text-sm text-[#e5e5e5] leading-relaxed italic flex-1">"{angle}"</p>
                    <div className="flex-shrink-0 mt-0.5">
                      <CopyButton text={angle} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : trend.hookAngle ? (
            <div className="space-y-1 pt-4 border-t border-[#111]">
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#333] uppercase tracking-widest">Gancho pronto</span>
                <CopyButton text={trend.hookAngle} />
              </div>
              <p className="text-sm text-[#e5e5e5] leading-relaxed italic">"{trend.hookAngle}"</p>
            </div>
          ) : null}

          {/* Execution tip */}
          {trend.executionTip && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#333] uppercase tracking-widest">Como executar</span>
                <CopyButton text={trend.executionTip} />
              </div>
              <p className="text-xs text-[#aaa] leading-relaxed">{trend.executionTip}</p>
            </div>
          )}

          {/* Publishing tip */}
          {trend.publishingTip && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock size={10} className="text-[#333]" />
                <span className="text-xs text-[#333] uppercase tracking-widest">Melhor janela</span>
              </div>
              <p className="text-xs text-[#aaa] leading-relaxed">{trend.publishingTip}</p>
            </div>
          )}

          {/* Saturation estimate */}
          {trend.saturationEstimate && <SaturationBlock sat={trend.saturationEstimate} />}

          {/* Retórica */}
          {trend.rhetoric && <RhetoricalBlock rhetoric={trend.rhetoric} />}

          {/* Comentários + atribuição */}
          {resolvedFetchedAt && (
            <CommentsSection trendId={trend.id} fetchedAt={resolvedFetchedAt} />
          )}

          {/* Salvar nos favoritos */}
          {(trend.hookAngles?.length || trend.hookAngle) ? (
            <div className="pt-4 border-t border-[#111]">
              <button
                onClick={handleSaveFromExpanded}
                disabled={saving}
                className="px-4 py-2 min-h-[44px] text-xs font-medium border border-[#333] text-[#e5e5e5] hover:border-white hover:bg-[#1a1a1a] transition-colors touch-manipulation disabled:opacity-40"
              >
                {saved
                  ? (savedFeedback ? 'Salvo ✓' : 'Já está nos favoritos')
                  : 'Salvar nos favoritos'
                }
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
