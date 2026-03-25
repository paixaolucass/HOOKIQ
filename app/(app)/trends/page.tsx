'use client'

import { useState, useEffect } from 'react'
import { AnalysisResult } from '@/types'
import TrendCard from '@/components/TrendCard'
import ExportBar from '@/components/ExportBar'

import {
  loadTrendsCache, saveTrendsCache, isCacheValid,
  timeAgo, remainingTime, fetchTrendsWithCache,
} from '@/lib/trends-cache'

export default function TrendsPage() {
  const [result, setResult]       = useState<AnalysisResult | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [, setTick]               = useState(0)

  useEffect(() => {
    const cache = loadTrendsCache()
    if (!cache) return
    setResult(cache.result)
    setFetchedAt(cache.fetchedAt)
  }, [])

  // Re-render every minute so remaining time stays current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  async function fetchTrends(force = false) {
    if (!force && fetchedAt && isCacheValid(fetchedAt) && result) return

    setError('')
    setLoading(true)

    try {
      const [data] = await fetchTrendsWithCache()
      setResult(data)
      const cache = loadTrendsCache()
      if (cache) setFetchedAt(cache.fetchedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const expired = fetchedAt ? !isCacheValid(fetchedAt) : true
  const hasResult = result?.trends && result.trends.length > 0

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-10">
        <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Módulo 2</h1>
        <h2 className="text-xl font-bold">Radar de Trends</h2>
        <p className="text-sm text-[#444] mt-2">
          Identifica o que está subindo no nicho de IA, criatividade e tecnologia.
        </p>
      </div>

      {error && <p className="mb-4 text-xs text-[#ef4444]">{error}</p>}

      {/* Botão */}
      <button
        onClick={() => fetchTrends(expired)}
        disabled={loading}
        className="w-full bg-white text-black py-3 text-sm font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 mb-3"
      >
        {loading
          ? 'Buscando trends ativas...'
          : !hasResult
            ? 'Buscar trends agora'
            : expired
              ? 'Cache expirado — buscar novamente'
              : 'Buscar trends agora'
        }
      </button>

      {/* Status do cache */}
      {!fetchedAt ? (
        <div className="mb-10 border border-[#1a1a1a] px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-xs text-[#444] uppercase tracking-widest mb-1">Cache</p>
            <p className="text-sm text-[#555]">Nenhuma busca realizada ainda</p>
          </div>
          <p className="text-xs text-[#333] text-right">
            Resultado salvo por <span className="text-[#e5e5e5]">4h</span> após buscar.<br />
            Navegar entre abas não gera custo.
          </p>
        </div>
      ) : expired ? (
        <div className="mb-10 border border-[#ef4444]/40 px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-xs text-[#ef4444]/60 uppercase tracking-widest mb-1">Cache expirado</p>
            <p className="text-2xl font-bold text-[#ef4444]">4h esgotadas</p>
            <p className="text-xs text-[#555] mt-1">buscado {timeAgo(fetchedAt)}</p>
          </div>
          <p className="text-xs text-[#555] text-right">
            Próxima busca chama a IA.<br />
            Novo cache de 4h será criado.
          </p>
        </div>
      ) : (
        <div className="mb-10 border border-[#22c55e]/30 px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-xs text-[#22c55e]/60 uppercase tracking-widest mb-1">Cache ativo</p>
            <p className="text-2xl font-bold text-[#22c55e]">{remainingTime(fetchedAt)}</p>
            <p className="text-xs text-[#444] mt-1">buscado {timeAgo(fetchedAt)}</p>
          </div>
          <p className="text-xs text-[#444] text-right">
            Resultado salvo localmente.<br />
            Sem custo até o cache expirar.
          </p>
        </div>
      )}

      {/* Resultados */}
      {hasResult && (() => {
        const sorted = [...result!.trends!].sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id))
        return (
          <>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs tracking-widest uppercase text-[#444]">Rank de trends</span>
              <div className="flex-1 border-t border-[#1a1a1a]" />
              <span className="text-xs text-[#333]">{sorted.length} identificadas</span>
              <ExportBar result={result!} type="trends" />
            </div>
            <div className="space-y-3">
              {sorted.map(trend => <TrendCard key={trend.id} trend={trend} />)}
            </div>
          </>
        )
      })()}
    </div>
  )
}
