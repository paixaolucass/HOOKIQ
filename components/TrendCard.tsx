'use client'

import { useState } from 'react'
import { Trend, TrendRhetoric } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

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

export default function TrendCard({ trend }: { trend: Trend }) {
  const [expanded, setExpanded] = useState(false)
  const config = windowConfig[trend.window]

  const rankColor = (trend.rankScore ?? 0) >= 8
    ? '#22c55e'
    : (trend.rankScore ?? 0) >= 6
      ? '#eab308'
      : '#555'

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">

      {/* Header clicável */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Rank */}
            {trend.rank != null && (
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold tabular-nums" style={{ color: rankColor }}>
                  #{trend.rank}
                </span>
                {trend.rankScore != null && (
                  <span className="text-xs text-[#333] ml-1">{trend.rankScore}/10</span>
                )}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold px-2 py-0.5 border"
                  style={{ color: config.color, borderColor: config.color + '40' }}
                >
                  {config.label}
                </span>
                <span className="text-xs text-[#444]">{trend.platform}</span>
              </div>
              <p className="text-xs" style={{ color: config.color + 'aa' }}>{config.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            <span className="text-xs text-[#444]">{expanded ? 'fechar' : 'detalhes'}</span>
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
          {/* Ângulo Overlens */}
          <div className="pt-4 space-y-1">
            <span className="text-xs text-[#333] uppercase tracking-wide">Ângulo Overlens</span>
            <p className="text-sm text-[#aaa] leading-relaxed">{trend.overlensAngle}</p>
          </div>

          {/* Justificativa do rank */}
          {trend.rankJustification && (
            <div className="space-y-1">
              <span className="text-xs text-[#333] uppercase tracking-wide">Por que #{trend.rank}</span>
              <p className="text-xs text-[#666] leading-relaxed">{trend.rankJustification}</p>
            </div>
          )}

          {/* Retórica */}
          {trend.rhetoric && <RhetoricalBlock rhetoric={trend.rhetoric} />}
        </div>
      )}
    </div>
  )
}
