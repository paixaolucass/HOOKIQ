'use client'

import { useState } from 'react'
import { Copy, FileDown } from 'lucide-react'
import { Cut, AnalysisResult } from '@/types'
import { downloadAnalysisPDF, downloadTrendsPDF } from '@/lib/pdf'

export default function ExportBar({
  cuts,
  result,
  type,
}: {
  cuts?: Cut[]
  result?: AnalysisResult
  type: 'analysis' | 'trends'
}) {
  const [copied, setCopied] = useState(false)

  function copyAll() {
    if (!cuts?.length) return
    const text = cuts.map(cut => {
      const lines = [
        `CORTE #${cut.id} — [${cut.type}] ${cut.destination}${cut.timestamp ? ` — ${cut.timestamp}` : ''}`,
        `Score: ${cut.score}/10${cut.duracaoEstimada ? ` · ${cut.duracaoEstimada}` : ''}${cut.producaoDificuldade ? ` · ${cut.producaoDificuldade}` : ''}`,
        `Trecho: "${cut.excerpt}"`,
        `Por que viraliza: ${cut.whyViral}`,
      ]
      if (cut.suggestedOpening) lines.push(`Abertura: "${cut.suggestedOpening}"`)
      if (cut.rhetorical?.cta?.suggested) lines.push(`CTA: "${cut.rhetorical.cta.suggested}"`)
      if (cut.titulosAlternativos?.length) {
        lines.push('Títulos:')
        cut.titulosAlternativos.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`))
      }
      if (cut.legendaSugerida) lines.push(`Legenda: ${cut.legendaSugerida}`)
      if (cut.hashtags?.length) lines.push(cut.hashtags.join(' '))
      return lines.join('\n')
    }).join('\n\n' + '─'.repeat(40) + '\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePDF() {
    if (!result) return
    if (type === 'analysis') downloadAnalysisPDF(result)
    else downloadTrendsPDF(result)
  }

  return (
    <div className="flex items-center gap-2">
      {type === 'analysis' && (
        <button
          onClick={copyAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
            copied
              ? 'border-[#22c55e] text-[#22c55e]'
              : 'border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444]'
          }`}
        >
          <Copy size={11} />
          {copied ? 'Copiado!' : 'Copiar todos'}
        </button>
      )}
      <button
        onClick={handlePDF}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444] transition-colors"
      >
        <FileDown size={11} />
        Baixar PDF
      </button>
    </div>
  )
}
