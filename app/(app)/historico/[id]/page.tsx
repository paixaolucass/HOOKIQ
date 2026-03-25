import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Session } from '@/types'
import Link from 'next/link'
import CutCard from '@/components/CutCard'
import TrendCard from '@/components/TrendCard'
import OpportunityAlert from '@/components/OpportunityAlert'
import ExportBar from '@/components/ExportBar'
import { ArrowLeft } from 'lucide-react'

const typeLabels: Record<string, string> = {
  transcription: 'Transcrição',
  trends: 'Trends',
  full: 'Full',
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const s = session as Session
  const result = s.result

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Back + Header */}
      <div className="mb-10">
        <Link
          href="/historico"
          className="flex items-center gap-2 text-xs text-[#444] hover:text-[#e5e5e5] transition-colors mb-6"
        >
          <ArrowLeft size={12} />
          Histórico
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">
              {typeLabels[s.type] ?? s.type}
            </h1>
            <h2 className="text-xl font-bold">Sessão</h2>
            <p className="text-xs text-[#333] mt-1">
              {new Date(s.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {s.input && (
          <details className="mt-4 group">
            <summary className="text-xs text-[#333] cursor-pointer hover:text-[#555] select-none">
              Ver transcrição original
            </summary>
            <div className="mt-2 border border-[#1a1a1a] bg-[#0d0d0d] p-4">
              <p className="text-xs text-[#555] font-mono leading-relaxed whitespace-pre-wrap">
                {s.input}
              </p>
            </div>
          </details>
        )}
      </div>

      <div className="space-y-8">
        {/* Alert */}
        {result.alert && (
          <div className="border border-[#eab308] px-4 py-3 text-xs text-[#eab308]">
            {result.alert}
          </div>
        )}

        {/* Cuts */}
        {result.cuts && result.cuts.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-xs tracking-widest uppercase text-[#444]">Cortes</h3>
              <div className="flex-1 border-t border-[#1a1a1a]" />
              {result.summary && (
                <span className="text-xs text-[#333]">{result.summary.totalCuts} identificados</span>
              )}
              <ExportBar cuts={result.cuts} result={result} type="analysis" />
            </div>
            <div className="space-y-3">
              {result.cuts.map(cut => <CutCard key={cut.id} cut={cut} />)}
            </div>
            {result.summary && (
              <div className="mt-4 pt-4 border-t border-[#1a1a1a] flex gap-6 text-xs text-[#444]">
                <span>Ruan: <span className="text-[#e5e5e5]">{result.summary.forRuan}</span></span>
                <span>Overlens: <span className="text-[#e5e5e5]">{result.summary.forOverlens}</span></span>
                <span>Ambos: <span className="text-[#e5e5e5]">{result.summary.forBoth}</span></span>
                <span>Top: <span className="text-[#e5e5e5]">Corte #{result.summary.topCutId}</span></span>
              </div>
            )}
          </section>
        )}

        {/* Opportunities */}
        {result.opportunities && result.opportunities.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-xs tracking-widest uppercase text-[#444]">Oportunidades combinadas</h3>
              <div className="flex-1 border-t border-[#1a1a1a]" />
            </div>
            <div className="space-y-3">
              {result.opportunities.map((opp, i) => (
                <OpportunityAlert key={i} opportunity={opp} />
              ))}
            </div>
          </section>
        )}

        {/* Trends */}
        {result.trends && result.trends.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-xs tracking-widest uppercase text-[#444]">Radar de trends</h3>
              <div className="flex-1 border-t border-[#1a1a1a]" />
              <span className="text-xs text-[#333]">{result.trends.length} identificadas</span>
              <ExportBar result={result} type="trends" />
            </div>
            <div className="space-y-3">
              {result.trends.map(trend => <TrendCard key={trend.id} trend={trend} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
