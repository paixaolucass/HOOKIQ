import { CombinedOpportunity } from '@/types'

export default function OpportunityAlert({ opportunity }: { opportunity: CombinedOpportunity }) {
  return (
    <div className="border border-[#2a2a00] bg-[#111100] p-4 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-sm">⚡</span>
        <span className="text-xs text-[#eab308] font-medium uppercase tracking-wide">
          Oportunidade combinada
        </span>
        <span className="text-xs text-[#444]">Corte #{opportunity.cutId} + {opportunity.trendName}</span>
      </div>
      <p className="text-sm text-[#e5e5e5] pl-5">{opportunity.executionSuggestion}</p>
    </div>
  )
}
