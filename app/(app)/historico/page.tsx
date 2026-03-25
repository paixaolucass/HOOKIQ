import { createClient } from '@/lib/supabase/server'
import { Session } from '@/types'
import Link from 'next/link'

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
      <div className="mb-10">
        <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Conta</h1>
        <h2 className="text-xl font-bold">Histórico</h2>
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
                <div className="flex items-center gap-3">
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
                </div>
                {session.input && (
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
