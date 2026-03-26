import { createClient } from '@/lib/supabase/server'
import { Session } from '@/types'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  salva:     '#555',
  gravando:  '#eab308',
  publicada: '#22c55e',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  acima:    '#22c55e',
  esperado: '#eab308',
  abaixo:   '#ef4444',
}

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50)

  if (sessionsError) console.error('[historico] query error:', sessionsError)

  const typeLabels: Record<string, string> = {
    transcription: 'Transcrição',
    trends: 'Trends',
    full: 'Full',
    trends_data: 'Trends (dados)',
    trends_data_ruan: 'Trends Ruan',
    trends_data_overlens: 'Trends Overlens',
    trends_social: 'Trends Social',
    trends_social_ruan: 'Trends Social (Ruan)',
    trends_social_overlens: 'Trends Social (Overlens)',
    saved_trend: 'Trend salva',
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Conta</h1>
          <h2 className="text-xl font-bold">Histórico</h2>
        </div>
        <div className="flex gap-4 text-xs pt-1">
          <Link href="/historico/analises" className="text-[#444] hover:text-[#e5e5e5] transition-colors">Análises</Link>
          <Link href="/historico/trends" className="text-[#444] hover:text-[#e5e5e5] transition-colors">Trends</Link>
        </div>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="text-sm text-[#444]">
          Nenhuma sessão ainda.{' '}
          <Link href="/analise" className="text-[#e5e5e5] underline">Fazer primeira análise</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session: Session) => (
            <Link
              key={session.id}
              href={`/historico/${session.id}`}
              className="block border border-[#1a1a1a] bg-[#0d0d0d] px-5 py-4 flex items-center justify-between hover:border-[#2a2a2a] hover:bg-[#111] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-[#e5e5e5]">
                    {typeLabels[session.type] ?? session.type}
                  </span>
                  {session.result.cuts && (
                    <span className="text-xs text-[#444]">
                      {session.result.cuts.length} cortes
                    </span>
                  )}
                  {session.result.trends && (
                    <span className="text-xs text-[#444]">
                      {session.result.trends.length} trends
                    </span>
                  )}
                  {session.type === 'saved_trend' && session.result.status && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 border uppercase tracking-wide"
                      style={{ color: STATUS_COLORS[session.result.status] ?? '#555', borderColor: (STATUS_COLORS[session.result.status] ?? '#555') + '40' }}
                    >
                      {session.result.status}
                    </span>
                  )}
                  {session.type === 'saved_trend' && session.result.performanceData && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 border"
                      style={{ color: ENGAGEMENT_COLORS[session.result.performanceData.engagement] ?? '#555', borderColor: (ENGAGEMENT_COLORS[session.result.performanceData.engagement] ?? '#555') + '40' }}
                    >
                      {session.result.performanceData.engagement}
                      {session.result.performanceData.views24h
                        ? ` · ${session.result.performanceData.views24h.toLocaleString('pt-BR')} views`
                        : ''}
                    </span>
                  )}
                </div>
                {session.type === 'saved_trend' && session.result.trend && (
                  <p className="text-xs text-[#555] truncate max-w-md">
                    {session.result.trend.superficialSubject} — {session.result.trend.platform}
                  </p>
                )}
                {session.type !== 'saved_trend' && session.input && (
                  <p className="text-xs text-[#333] truncate max-w-md">
                    {session.input.slice(0, 80)}...
                  </p>
                )}
              </div>
              <div className="text-xs text-[#333] whitespace-nowrap">
                {new Date(session.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
