'use client'

import { useState } from 'react'
import { Cut, ScoreCriterion, RhetoricalAnalysis, ProducaoDificuldade, Roteiro } from '@/types'
import { Copy, Pencil, Check, X, ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react'

const hookColors: Record<string, string> = {
  'TENSÃO':     '#ef4444',
  'INSIGHT':    '#3b82f6',
  'IMPACTO':    '#a855f7',
  'DADO':       '#22c55e',
  'HISTÓRIA':   '#f97316',
  'PROVOCAÇÃO': '#eab308',
  'BASTIDOR':   '#64748b',
}

const destColors: Record<string, string> = {
  'RUAN':     '#3b82f6',
  'OVERLENS': '#a855f7',
  'AMBOS':    '#22c55e',
}

const scoreLabels = [
  { key: 'hookSpeed',           label: 'Velocidade do gancho' },
  { key: 'contextIndependence', label: 'Independência de contexto' },
  { key: 'emotionalCharge',     label: 'Carga emocional' },
  { key: 'retentionPull',       label: 'Poder de retenção' },
  { key: 'nicheAlignment',      label: 'Alinhamento de nicho' },
] as const

function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-3 h-1" style={{ background: i < value ? '#e5e5e5' : '#222' }} />
      ))}
    </div>
  )
}

function RhetoricalBlock({ rhetorical }: { rhetorical: RhetoricalAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="text-xs text-[#333] uppercase tracking-widest">Retórica aristotélica</div>

      {/* Ethos */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#e5e5e5]">ETHOS</span>
          <MiniBar value={rhetorical.ethos.score} />
          <span className="text-xs text-[#444]">{rhetorical.ethos.score}/2</span>
          <span className="text-xs text-[#444]">— credibilidade</span>
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetorical.ethos.analysis}</p>
      </div>

      {/* Pathos */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[#e5e5e5]">PATHOS</span>
          <MiniBar value={rhetorical.pathos.score} />
          <span className="text-xs text-[#444]">{rhetorical.pathos.score}/2</span>
          {rhetorical.pathos.emotion && (
            <span className="text-xs text-[#eab308] border border-[#eab308]/30 px-1.5 py-0.5">{rhetorical.pathos.emotion}</span>
          )}
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetorical.pathos.analysis}</p>
      </div>

      {/* Logos */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#e5e5e5]">LOGOS</span>
          <MiniBar value={rhetorical.logos.score} />
          <span className="text-xs text-[#444]">{rhetorical.logos.score}/2</span>
          <span className="text-xs text-[#444]">— convicção lógica</span>
        </div>
        <p className="text-xs text-[#666] leading-relaxed">{rhetorical.logos.analysis}</p>
      </div>

      {/* CTA */}
      {rhetorical.cta && (
        <div className="space-y-2 pt-3 border-t border-[#111]">
          <div className="text-xs text-[#333] uppercase tracking-widest">CTA</div>
          {rhetorical.cta.existing && (
            <div className="space-y-0.5">
              <span className="text-xs text-[#444]">Existente no trecho</span>
              <p className="text-xs text-[#aaa] font-mono border-l border-[#222] pl-2">&ldquo;{rhetorical.cta.existing}&rdquo;</p>
            </div>
          )}
          {rhetorical.cta.suggested && (
            <div className="space-y-0.5">
              <span className="text-xs text-[#444]">Sugerido</span>
              <p className="text-xs text-[#e5e5e5] font-mono border-l-2 border-[#333] pl-2">&ldquo;{rhetorical.cta.suggested}&rdquo;</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CriterionRow({ label, criterion }: { label: string; criterion: ScoreCriterion }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#555] uppercase tracking-wide">{label}</span>
        <div className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-1" style={{ background: i < criterion.score ? '#e5e5e5' : '#222' }} />
          ))}
        </div>
        <span className="text-xs text-[#333] tabular-nums">{criterion.score}/2</span>
      </div>
      <p className="text-xs text-[#666] leading-relaxed">{criterion.reason}</p>
    </div>
  )
}

const producaoConfig: Record<ProducaoDificuldade, { color: string; label: string; desc: string }> = {
  'SOLO':     { color: '#22c55e', label: 'SOLO',     desc: 'câmera + fala' },
  'SIMPLES':  { color: '#eab308', label: 'SIMPLES',  desc: 'cortes básicos, texto na tela' },
  'PRODUÇÃO': { color: '#ef4444', label: 'PRODUÇÃO', desc: 'B-roll, motion, recursos visuais' },
}

export default function CutCard({ cut }: { cut: Cut }) {
  const [expanded, setExpanded]           = useState(false)
  const [editing, setEditing]             = useState(false)
  const [editedOpening, setEditedOpening] = useState(cut.suggestedOpening ?? '')
  const [copied, setCopied]               = useState(false)
  const [copiedBrief, setCopiedBrief]     = useState(false)
  const [copiedLegenda, setCopiedLegenda] = useState(false)
  const [copiedHashtags, setCopiedHashtags] = useState(false)
  const [copiedTitulo, setCopiedTitulo]   = useState<number | null>(null)
  const [roteiro, setRoteiro]             = useState<Roteiro | null>(cut.roteiro ?? null)
  const [roteiroLoading, setRoteiroLoading] = useState(false)
  const [roteiroError, setRoteiroError]   = useState('')
  const [copiedRoteiro, setCopiedRoteiro] = useState(false)

  function copyOpening() {
    const text = editing ? editedOpening : (cut.suggestedOpening ?? '')
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function copyLegenda() {
    if (!cut.legendaSugerida) return
    navigator.clipboard.writeText(cut.legendaSugerida)
    setCopiedLegenda(true)
    setTimeout(() => setCopiedLegenda(false), 1500)
  }

  function copyHashtags() {
    if (!cut.hashtags?.length) return
    navigator.clipboard.writeText(cut.hashtags.join(' '))
    setCopiedHashtags(true)
    setTimeout(() => setCopiedHashtags(false), 1500)
  }

  function copyBrief() {
    const lines: string[] = []
    lines.push(`CORTE #${cut.id} — ${cut.type} — ${cut.destination}`)
    if (cut.duracaoEstimada || cut.producaoDificuldade)
      lines.push(`${cut.duracaoEstimada ?? ''}${cut.duracaoEstimada && cut.producaoDificuldade ? ' · ' : ''}${cut.producaoDificuldade ?? ''}`)
    lines.push('')
    lines.push(`"${cut.excerpt}"`)
    lines.push('')
    lines.push(`Por que viraliza: ${cut.whyViral}`)
    if (cut.suggestedOpening) {
      lines.push('', 'ABERTURA:', `"${cut.suggestedOpening}"`)
    }
    if (cut.rhetorical?.cta?.suggested) {
      lines.push('', `CTA: "${cut.rhetorical.cta.suggested}"`)
    }
    if (cut.titulosAlternativos?.length) {
      lines.push('', 'TÍTULOS:')
      cut.titulosAlternativos.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
    }
    if (cut.legendaSugerida) {
      lines.push('', 'LEGENDA:', cut.legendaSugerida)
    }
    if (cut.hashtags?.length) {
      lines.push('', cut.hashtags.join(' '))
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedBrief(true)
    setTimeout(() => setCopiedBrief(false), 2000)
  }

  function copyRoteiro() {
    if (!roteiro) return
    const lines = [
      `ROTEIRO — CORTE #${cut.id}`,
      '',
      `ABERTURA:\n"${roteiro.abertura}"`,
      '',
      'DESENVOLVIMENTO:',
      ...roteiro.desenvolvimento.map((p, i) => `${i + 1}. ${p}`),
      '',
      `FECHAMENTO:\n"${roteiro.fechamento}"`,
    ]
    if (roteiro.observacoes) lines.push('', `Obs: ${roteiro.observacoes}`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedRoteiro(true)
    setTimeout(() => setCopiedRoteiro(false), 2000)
  }

  async function gerarRoteiro() {
    setRoteiro(null)
    setRoteiroLoading(true)
    setRoteiroError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'roteiro', cut }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar roteiro')
      setRoteiro(data)
    } catch (e) {
      setRoteiroError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setRoteiroLoading(false)
    }
  }

  function copyTitulo(idx: number, titulo: string) {
    navigator.clipboard.writeText(titulo)
    setCopiedTitulo(idx)
    setTimeout(() => setCopiedTitulo(null), 1500)
  }

  const displayOpening = editing ? editedOpening : (cut.suggestedOpening ?? '')

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">

      {/* ── Header (sempre visível, clicável) ── */}
      <div
        className="p-5 space-y-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Linha de meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[#333]">#{cut.id}</span>
            <span
              className="text-xs font-mono font-bold px-1.5 py-0.5 border"
              style={{ color: hookColors[cut.type] ?? '#e5e5e5', borderColor: hookColors[cut.type] ?? '#333' }}
            >
              {cut.type}
            </span>
            <span className="text-xs font-medium" style={{ color: destColors[cut.destination] ?? '#e5e5e5' }}>
              {cut.destination}
            </span>
            {cut.timestamp && (
              <span className="text-xs font-mono text-[#333]">{cut.timestamp}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); copyBrief() }}
              className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${
                copiedBrief ? 'border-[#22c55e] text-[#22c55e]' : 'border-[#1a1a1a] text-[#444] hover:text-[#e5e5e5] hover:border-[#333]'
              }`}
              title="Copiar brief completo"
            >
              <Copy size={10} />
              {copiedBrief ? 'Copiado!' : 'Brief'}
            </button>
            <span
              className="text-sm font-bold tabular-nums"
              style={{
                color: cut.score >= 9 ? '#22c55e' : cut.score >= 7 ? '#eab308' : '#555'
              }}
            >
              {cut.score}<span className="text-xs font-normal text-[#333]">/10</span>
            </span>
            {expanded
              ? <ChevronUp size={12} className="text-[#333]" />
              : <ChevronDown size={12} className="text-[#333]" />
            }
          </div>
        </div>

        {/* Trecho */}
        <blockquote className="text-sm text-[#aaa] border-l-2 border-[#222] pl-3 font-mono leading-relaxed">
          &ldquo;{cut.excerpt}&rdquo;
        </blockquote>

        {/* Por que viraliza */}
        <p className="text-xs text-[#666] leading-relaxed">{cut.whyViral}</p>
      </div>

      {/* ── Painel expandido ── */}
      {expanded && (
        <div
          className="border-t border-[#111] px-5 pb-5 space-y-6"
          onClick={e => e.stopPropagation()}
        >

          {/* Retórica aristotélica */}
          {cut.rhetorical && (
            <div className="pt-5">
              <RhetoricalBlock rhetorical={cut.rhetorical} />
            </div>
          )}

          {/* Score breakdown com justificativas */}
          {cut.scoreBreakdown && (
            <div className="pt-5 space-y-4">
              <div className="text-xs text-[#333] uppercase tracking-widest">Análise por critério</div>
              {scoreLabels.map(({ key, label }) => {
                const criterion = cut.scoreBreakdown![key]
                if (!criterion) return null
                return <CriterionRow key={key} label={label} criterion={criterion} />
              })}
              {cut.scoreBreakdown.dominantEmotion && (
                <div className="pt-3 border-t border-[#111] flex items-baseline gap-2">
                  <span className="text-xs text-[#444] uppercase tracking-wide">Emoção dominante</span>
                  <span className="text-xs text-[#e5e5e5]">{cut.scoreBreakdown.dominantEmotion}</span>
                </div>
              )}
            </div>
          )}

          {/* Justificativa do tipo de gancho */}
          {cut.hookJustification && (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest" style={{ color: hookColors[cut.type] ?? '#444' }}>
                Por que {cut.type}
              </div>
              <p className="text-xs text-[#666] leading-relaxed">{cut.hookJustification}</p>
            </div>
          )}

          {/* Dica de formato */}
          {cut.formatTip && (
            <div className="space-y-1">
              <div className="text-xs text-[#333] uppercase tracking-widest">Formato / edição</div>
              <p className="text-xs text-[#666] leading-relaxed italic">{cut.formatTip}</p>
            </div>
          )}

          {/* Timestamp */}
          {cut.timestamp && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#333] uppercase tracking-widest">Timestamp</span>
              <span className="text-xs font-mono text-[#e5e5e5] bg-[#111] border border-[#1a1a1a] px-2 py-0.5">
                {cut.timestamp}
              </span>
            </div>
          )}

          {/* Produção */}
          {(cut.duracaoEstimada || cut.producaoDificuldade || cut.titulosAlternativos?.length || cut.legendaSugerida || cut.hashtags?.length) && (
            <div className="space-y-5 pt-5 border-t border-[#111]">
              <div className="text-xs text-[#333] uppercase tracking-widest">Produção</div>

              {/* Dificuldade + Duração */}
              <div className="flex items-center gap-4 flex-wrap">
                {cut.producaoDificuldade && (() => {
                  const cfg = producaoConfig[cut.producaoDificuldade]
                  return (
                    <span
                      className="text-xs font-bold px-2 py-0.5 border"
                      style={{ color: cfg.color, borderColor: cfg.color + '40' }}
                    >
                      {cfg.label} — {cfg.desc}
                    </span>
                  )
                })()}
                {cut.duracaoEstimada && (
                  <span className="text-xs text-[#555] font-mono">⏱ {cut.duracaoEstimada}</span>
                )}
              </div>

              {/* Títulos alternativos */}
              {cut.titulosAlternativos && cut.titulosAlternativos.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-[#444] uppercase tracking-wide">Títulos</div>
                  {cut.titulosAlternativos.map((titulo, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 group">
                      <p className="text-xs text-[#aaa] flex-1">{i + 1}. {titulo}</p>
                      <button
                        onClick={() => copyTitulo(i, titulo)}
                        className={`flex-shrink-0 transition-colors ${copiedTitulo === i ? 'text-[#22c55e]' : 'text-[#333] hover:text-[#e5e5e5]'}`}
                        title="Copiar"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Legenda sugerida */}
              {cut.legendaSugerida && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[#444] uppercase tracking-wide">Legenda</div>
                    <button
                      onClick={copyLegenda}
                      className={`flex items-center gap-1 text-xs transition-colors ${copiedLegenda ? 'text-[#22c55e]' : 'text-[#333] hover:text-[#e5e5e5]'}`}
                    >
                      <Copy size={10} />
                      {copiedLegenda ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-xs text-[#666] leading-relaxed border-l border-[#222] pl-2">{cut.legendaSugerida}</p>
                </div>
              )}

              {/* Hashtags */}
              {cut.hashtags && cut.hashtags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[#444] uppercase tracking-wide">Hashtags</div>
                    <button
                      onClick={copyHashtags}
                      className={`flex items-center gap-1 text-xs transition-colors ${copiedHashtags ? 'text-[#22c55e]' : 'text-[#333] hover:text-[#e5e5e5]'}`}
                    >
                      <Copy size={10} />
                      {copiedHashtags ? 'Copiado!' : 'Copiar todos'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cut.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs text-[#555] border border-[#1a1a1a] px-2 py-0.5 font-mono">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roteiro */}
          <div className="space-y-4 pt-5 border-t border-[#111]">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#333] uppercase tracking-widest">Roteiro completo</div>
              {!roteiro && (
                <button
                  onClick={gerarRoteiro}
                  disabled={roteiroLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444] transition-colors disabled:opacity-40"
                >
                  {roteiroLoading ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                  {roteiroLoading ? 'Gerando...' : 'Gerar roteiro'}
                </button>
              )}
            </div>
            {roteiroError && <p className="text-xs text-[#ef4444]">{roteiroError}</p>}
            {roteiro && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-[#444] uppercase tracking-wide">Abertura</div>
                  <p className="text-sm text-[#e5e5e5] bg-[#111] border border-[#1a1a1a] px-3 py-2 leading-relaxed">&ldquo;{roteiro.abertura}&rdquo;</p>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-[#444] uppercase tracking-wide">Desenvolvimento</div>
                  {roteiro.desenvolvimento.map((ponto, i) => (
                    <div key={i} className="flex gap-3 text-xs text-[#aaa] leading-relaxed">
                      <span className="text-[#333] flex-shrink-0">{i + 1}.</span>
                      <span>{ponto}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[#444] uppercase tracking-wide">Fechamento + CTA</div>
                  <p className="text-sm text-[#e5e5e5] bg-[#111] border border-[#1a1a1a] px-3 py-2 leading-relaxed">&ldquo;{roteiro.fechamento}&rdquo;</p>
                </div>
                {roteiro.observacoes && (
                  <p className="text-xs text-[#555] italic border-l border-[#1a1a1a] pl-2">{roteiro.observacoes}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={copyRoteiro}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                      copiedRoteiro ? 'border-[#22c55e] text-[#22c55e]' : 'border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444]'
                    }`}
                  >
                    <Copy size={10} />
                    {copiedRoteiro ? 'Copiado!' : 'Copiar roteiro'}
                  </button>
                  <button
                    onClick={gerarRoteiro}
                    disabled={roteiroLoading}
                    className="text-xs text-[#333] hover:text-[#555] transition-colors disabled:opacity-40"
                  >
                    Regenerar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Abertura sugerida */}
          {cut.suggestedOpening !== undefined && (
            <div className="space-y-2 pt-1 border-t border-[#111]">
              <div className="text-xs text-[#333] uppercase tracking-widest">Abertura sugerida</div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {editing ? (
                    <textarea
                      value={editedOpening}
                      onChange={e => setEditedOpening(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full bg-[#111] border border-[#333] text-[#e5e5e5] px-3 py-2 text-sm outline-none focus:border-[#555] resize-none"
                    />
                  ) : (
                    <p className="text-sm text-[#e5e5e5] leading-relaxed">{displayOpening}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                  {editing ? (
                    <>
                      <button onClick={() => setEditing(false)} className="text-[#22c55e] hover:text-[#4ade80] transition-colors" title="Salvar">
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => { setEditedOpening(cut.suggestedOpening ?? ''); setEditing(false) }}
                        className="text-[#444] hover:text-[#e5e5e5] transition-colors"
                        title="Cancelar"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditing(true)} className="text-[#333] hover:text-[#e5e5e5] transition-colors" title="Editar">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={copyOpening}
                        className={`transition-colors ${copied ? 'text-[#22c55e]' : 'text-[#333] hover:text-[#e5e5e5]'}`}
                        title="Copiar"
                      >
                        <Copy size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
