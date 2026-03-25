import { Trend } from '@/types'

const windowConfig = {
  ABERTA:   { color: '#22c55e', label: 'ABERTA',   time: '0–2 dias de crescimento' },
  FECHANDO: { color: '#eab308', label: 'FECHANDO', time: '3–5 dias — entre com ângulo diferente' },
  FECHADA:  { color: '#ef4444', label: 'FECHADA',  time: '6+ dias — apenas ângulo completamente novo' },
}

export default function TrendCard({ trend }: { trend: Trend }) {
  const config = windowConfig[trend.window]

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
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
        <span className="text-xs text-[#333] flex-shrink-0">#{trend.id}</span>
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
        <div>
          <span className="text-xs text-[#333] uppercase tracking-wide">Ângulo Overlens</span>
          <p className="text-sm text-[#aaa] mt-0.5">{trend.overlensAngle}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-[#1a1a1a]">
        <p className="text-xs" style={{ color: config.color }}>⚡ {trend.urgency}</p>
      </div>
    </div>
  )
}
