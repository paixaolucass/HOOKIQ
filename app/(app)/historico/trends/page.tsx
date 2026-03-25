'use client'

import { useState, useEffect } from 'react'
import type { Trend } from '@/types'
import TrendCard from '@/components/TrendCard'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface TrendsSession {
  id: string
  type: string
  trends: Trend[]
  created_at: string
}

function groupByDay(sessions: TrendsSession[]): { date: string; sessions: TrendsSession[] }[] {
  const map = new Map<string, TrendsSession[]>()
  for (const s of sessions) {
    const date = new Date(s.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(s)
  }
  return Array.from(map.entries()).map(([date, sessions]) => ({ date, sessions }))
}

function DayGroup({ date, sessions }: { date: string; sessions: TrendsSession[] }) {
  const [expanded, setExpanded] = useState(false)

  const allTrends = sessions.flatMap(s => s.trends)
  const abertaCount = allTrends.filter(t => t.window === 'ABERTA').length
  const fechandoCount = allTrends.filter(t => t.window === 'FECHANDO').length
  const fechadaCount = allTrends.filter(t => t.window === 'FECHADA').length
  const top3 = [...allTrends]
    .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
    .slice(0, 3)

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">
      <div
        className="px-5 py-4 cursor-pointer select-none flex items-start justify-between gap-4"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-[#e5e5e5]">{date}</span>
            <span className="text-xs text-[#444]">
              {new Date(sessions[0].created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-[#333]">{allTrends.length} trends</span>
          </div>

          <div className="flex gap-3 text-xs flex-wrap">
            {abertaCount > 0 && (
              <span style={{ color: '#22c55e' }}>{abertaCount} abertas</span>
            )}
            {fechandoCount > 0 && (
              <span style={{ color: '#eab308' }}>{fechandoCount} fechando</span>
            )}
            {fechadaCount > 0 && (
              <span style={{ color: '#ef4444' }}>{fechadaCount} fechadas</span>
            )}
          </div>

          {top3.length > 0 && !expanded && (
            <div className="flex flex-wrap gap-2">
              {top3.map(t => (
                <span key={t.id} className="text-xs text-[#555] border border-[#1a1a1a] px-2 py-0.5">
                  {t.superficialSubject}
                  {t.rankScore != null && <span className="text-[#333] ml-1">{t.rankScore}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#444]">{expanded ? 'fechar' : 'ver completo'}</span>
          {expanded
            ? <ChevronUp size={12} className="text-[#333]" />
            : <ChevronDown size={12} className="text-[#333]" />
          }
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#111] px-5 pb-5 pt-4 space-y-3">
          {allTrends
            .sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id))
            .map(trend => (
              <TrendCard key={`${trend.id}-${sessions[0].id}`} trend={trend} />
            ))
          }
        </div>
      )}
    </div>
  )
}

export default function HistoricoTrendsPage() {
  const [sessions, setSessions] = useState<TrendsSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Não autenticado'); setLoading(false); return }

      const { data, error: dbError } = await supabase
        .from('sessions')
        .select('id, type, result, created_at')
        .eq('user_id', user.id)
        .in('type', ['trends_data', 'trends_social', 'trends_data_ruan', 'trends_data_overlens'])
        .order('created_at', { ascending: false })
        .limit(20)

      if (dbError) { setError(dbError.message); setLoading(false); return }

      const parsed: TrendsSession[] = (data ?? []).map(row => ({
        id: row.id,
        type: row.type,
        trends: (row.result as { trends?: Trend[] })?.trends ?? [],
        created_at: row.created_at,
      })).filter(s => s.trends.length > 0)

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
          <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Trends</h1>
          <h2 className="text-xl font-bold">Histórico de buscas</h2>
        </div>
        <Link href="/trends" className="text-xs text-[#444] hover:text-[#e5e5e5] transition-colors">
          Voltar para Radar
        </Link>
      </div>

      {loading && <p className="text-xs text-[#444]">Carregando...</p>}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <div className="text-sm text-[#444]">
          Nenhuma busca de trends ainda.{' '}
          <Link href="/trends" className="text-[#e5e5e5] underline">Fazer primeira busca</Link>
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map(g => (
            <DayGroup key={g.date} date={g.date} sessions={g.sessions} />
          ))}
        </div>
      )}
    </div>
  )
}
