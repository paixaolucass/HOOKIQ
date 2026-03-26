'use client'

import { useState, useEffect } from 'react'
import type { AnalysisResult, Cut } from '@/types'
import CutCard from '@/components/CutCard'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AnalysisSession {
  id: string
  result: AnalysisResult
  input?: string
  created_at: string
}

function groupByDay(sessions: AnalysisSession[]): { date: string; sessions: AnalysisSession[] }[] {
  const map = new Map<string, AnalysisSession[]>()
  for (const s of sessions) {
    const date = new Date(s.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(s)
  }
  return Array.from(map.entries()).map(([date, sessions]) => ({ date, sessions }))
}

function SessionBlock({ session }: { session: AnalysisSession }) {
  const [expanded, setExpanded] = useState(false)
  const cuts: Cut[] = session.result.cuts ?? []
  const avgScore = cuts.length > 0
    ? Math.round(cuts.reduce((s, c) => s + c.score, 0) / cuts.length * 10) / 10
    : null
  const top = cuts.reduce<Cut | null>((best, c) => !best || c.score > best.score ? c : best, null)

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">
      <div
        className="px-5 py-4 cursor-pointer select-none flex items-start justify-between gap-4"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[#444]">
              {new Date(session.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-[#333]">{cuts.length} cortes</span>
            {avgScore !== null && (
              <span className="text-xs text-[#555]">média {avgScore}/10</span>
            )}
            {top && (
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: top.score >= 9 ? '#22c55e' : top.score >= 7 ? '#eab308' : '#555' }}
              >
                top {top.score}
              </span>
            )}
          </div>

          {session.input && !expanded && (
            <p className="text-xs text-[#333] truncate max-w-lg">
              {session.input.slice(0, 100)}...
            </p>
          )}

          {!expanded && top && (
            <p className="text-xs text-[#555] italic truncate max-w-lg">
              &ldquo;{top.excerpt.slice(0, 80)}&rdquo;
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#444]">{expanded ? 'fechar' : 'ver cortes'}</span>
          {expanded
            ? <ChevronUp size={12} className="text-[#333]" />
            : <ChevronDown size={12} className="text-[#333]" />
          }
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#111] px-5 pb-5 pt-4 space-y-3">
          {cuts.length > 0
            ? cuts
                .sort((a, b) => b.score - a.score)
                .map(cut => <CutCard key={cut.id} cut={cut} />)
            : <p className="text-xs text-[#444]">Nenhum corte nessa sessão.</p>
          }
        </div>
      )}
    </div>
  )
}

function DayGroup({ date, sessions }: { date: string; sessions: AnalysisSession[] }) {
  const allCuts = sessions.flatMap(s => s.result.cuts ?? [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs font-medium text-[#e5e5e5]">{date}</span>
        <span className="text-xs text-[#333]">{allCuts.length} cortes · {sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''}</span>
        <div className="flex-1 border-t border-[#1a1a1a]" />
      </div>
      {sessions.map(s => <SessionBlock key={s.id} session={s} />)}
    </div>
  )
}

export default function HistoricoAnalisesPage() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Não autenticado'); setLoading(false); return }

      const { data, error: dbError } = await supabase
        .from('sessions')
        .select('id, result, input, created_at')
        .eq('user_id', user.id)
        .eq('type', 'transcription')
        .order('created_at', { ascending: false })
        .limit(30)

      if (dbError) { setError(dbError.message); setLoading(false); return }

      const parsed: AnalysisSession[] = (data ?? [])
        .filter(row => Array.isArray((row.result as AnalysisResult)?.cuts))
        .map(row => ({
          id: row.id,
          result: row.result as AnalysisResult,
          input: typeof row.input === 'string' ? row.input : undefined,
          created_at: row.created_at,
        }))

      setSessions(parsed)
      setLoading(false)
    }
    load()
  }, [])

  const grouped = groupByDay(sessions)

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Análise</h1>
          <h2 className="text-xl font-bold">Histórico de análises</h2>
        </div>
        <Link href="/analise" className="text-xs text-[#444] hover:text-[#e5e5e5] transition-colors">
          Nova análise
        </Link>
      </div>

      {loading && <p className="text-xs text-[#444]">Carregando...</p>}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <div className="text-sm text-[#444]">
          Nenhuma análise ainda.{' '}
          <Link href="/analise" className="text-[#e5e5e5] underline">Fazer primeira análise</Link>
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(g => (
            <DayGroup key={g.date} date={g.date} sessions={g.sessions} />
          ))}
        </div>
      )}
    </div>
  )
}
