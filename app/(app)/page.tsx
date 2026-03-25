'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisResult, HookType, Destination } from '@/types'
import CutCard from '@/components/CutCard'
import TrendCard from '@/components/TrendCard'
import OpportunityAlert from '@/components/OpportunityAlert'
import ExportBar from '@/components/ExportBar'
import { loadTrendsCache, isCacheValid, timeAgo, remainingTime, fetchTrendsWithCache } from '@/lib/trends-cache'

type Mode = 'transcription' | 'trends' | 'full'
type FilterDest = Destination | 'TODOS'
type FilterType = HookType | 'TODOS'
type FilterScore = 5 | 7 | 9

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('transcription')
  const [transcription, setTranscription] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [trendsFetchedAt, setTrendsFetchedAt] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const [filterDest, setFilterDest]   = useState<FilterDest>('TODOS')
  const [filterType, setFilterType]   = useState<FilterType>('TODOS')
  const [filterScore, setFilterScore] = useState<FilterScore>(5)

  useEffect(() => {
    const cache = loadTrendsCache()
    if (cache) setTrendsFetchedAt(cache.fetchedAt)
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') setTranscription(text)
    }
    reader.readAsText(file, 'UTF-8')
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  async function handleSubmit() {
    if ((mode === 'transcription' || mode === 'full') && !transcription.trim()) {
      setError('Cole a transcrição antes de analisar.')
      return
    }

    setError('')
    setLoading(true)
    setResult(null)
    setFilterDest('TODOS')
    setFilterType('TODOS')
    setFilterScore(5)

    try {
      if (mode === 'trends') {
        const [data] = await fetchTrendsWithCache()
        const cache = loadTrendsCache()
        if (cache) setTrendsFetchedAt(cache.fetchedAt)
        setResult(data)
      } else if (mode === 'transcription') {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcription, mode: 'transcription' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro na análise')
        setResult(data)
      } else {
        // FULL: run both in parallel
        const [analyzeRes, trendsResult] = await Promise.all([
          fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcription, mode: 'transcription' }),
          }),
          fetchTrendsWithCache(),
        ])

        const analyzeData = await analyzeRes.json()
        const [trendsData] = trendsResult
        const cache = loadTrendsCache()
        if (cache) setTrendsFetchedAt(cache.fetchedAt)

        if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Erro na análise')

        // Cross-reference: only if we have cuts >= 7 and ABERTA/FECHANDO trends
        const highScoreCuts = analyzeData.cuts?.filter((c: { score: number }) => c.score >= 7) ?? []
        const activeTrends = trendsData.trends?.filter((t: { window: string }) => t.window !== 'FECHADA') ?? []

        let opportunities = []
        if (highScoreCuts.length > 0 && activeTrends.length > 0) {
          const crossRes = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'cross',
              cuts: highScoreCuts,
              trends: activeTrends
            }),
          })
          const crossData = await crossRes.json()
          opportunities = crossData.opportunities ?? []
        }

        setResult({
          cuts: analyzeData.cuts,
          summary: analyzeData.summary,
          alert: analyzeData.alert,
          trends: trendsData.trends,
          opportunities,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const showTranscriptionInput = mode === 'transcription' || mode === 'full'

  const filteredCuts = result?.cuts?.filter(c =>
    c.score >= filterScore &&
    (filterDest === 'TODOS' || c.destination === filterDest || c.destination === 'AMBOS') &&
    (filterType === 'TODOS' || c.type === filterType)
  ) ?? []

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-xs text-[#444] tracking-widest uppercase mb-1">Sistema Editorial</h1>
        <h2 className="text-xl font-bold">Nova sessão</h2>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        {(['transcription', 'trends', 'full'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setError('') }}
            className={`px-4 py-2 text-xs font-medium border transition-colors uppercase tracking-wide ${
              mode === m
                ? 'border-white text-white bg-[#1a1a1a]'
                : 'border-[#222] text-[#555] hover:text-[#e5e5e5] hover:border-[#444]'
            }`}
          >
            {m === 'transcription' ? 'Transcrição' : m === 'trends' ? 'Trends' : 'Full'}
          </button>
        ))}
      </div>

      {/* Transcription input */}
      {showTranscriptionInput && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-[#333] text-[#e5e5e5] hover:border-white hover:bg-[#1a1a1a] transition-colors"
            >
              <span>↑</span> Carregar arquivo
            </button>
            <span className="text-xs text-[#333]">
              txt, md, srt, json e outros
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt,.vtt,.csv,.json,.xml,.html,.rtf,.log,.tsv,.yaml,.yml,.tex,.rst"
            onChange={handleFileUpload}
            className="hidden"
          />
          <textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            placeholder="Cole a transcrição bruta aqui..."
            rows={8}
            className="w-full bg-[#111] border border-[#222] text-[#e5e5e5] px-4 py-3 text-sm outline-none focus:border-[#333] transition-colors placeholder:text-[#333] resize-none font-mono"
          />
          <div className="text-right text-xs text-[#333] mt-1">
            {transcription.length.toLocaleString()} caracteres
          </div>
        </div>
      )}

      {(mode === 'trends' || mode === 'full') && !loading && (() => {
        const expired = trendsFetchedAt ? !isCacheValid(trendsFetchedAt) : true
        return !trendsFetchedAt ? (
          <div className="mb-6 border border-[#1a1a1a] px-5 py-4 flex items-center justify-between gap-6">
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
          <div className="mb-6 border border-[#ef4444]/40 px-5 py-4 flex items-center justify-between gap-6">
            <div>
              <p className="text-xs text-[#ef4444]/60 uppercase tracking-widest mb-1">Cache expirado</p>
              <p className="text-2xl font-bold text-[#ef4444]">4h esgotadas</p>
              <p className="text-xs text-[#555] mt-1">buscado {timeAgo(trendsFetchedAt)}</p>
            </div>
            <p className="text-xs text-[#555] text-right">
              Próxima busca chama a IA.<br />
              Novo cache de 4h será criado.
            </p>
          </div>
        ) : (
          <div className="mb-6 border border-[#22c55e]/30 px-5 py-4 flex items-center justify-between gap-6">
            <div>
              <p className="text-xs text-[#22c55e]/60 uppercase tracking-widest mb-1">Cache ativo</p>
              <p className="text-2xl font-bold text-[#22c55e]">{remainingTime(trendsFetchedAt)}</p>
              <p className="text-xs text-[#444] mt-1">buscado {timeAgo(trendsFetchedAt)}</p>
            </div>
            <p className="text-xs text-[#444] text-right">
              Resultado salvo localmente.<br />
              Sem custo até o cache expirar.
            </p>
          </div>
        )
      })()}

      {error && (
        <p className="mb-4 text-xs text-[#ef4444]">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-white text-black py-3 text-sm font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-10"
      >
        {loading
          ? mode === 'trends' ? 'Buscando trends...' : 'Analisando...'
          : mode === 'transcription' ? 'Analisar transcrição'
          : mode === 'trends' ? 'Buscar trends agora'
          : 'Análise completa'
        }
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Alert */}
          {result.alert && (
            <div className="border border-[#eab308] px-4 py-3 text-xs text-[#eab308]">
              {result.alert}
            </div>
          )}

          {/* Trends — primeiro */}
          {result.trends && result.trends.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xs tracking-widest uppercase text-[#444]">Rank de trends</h3>
                <div className="flex-1 border-t border-[#1a1a1a]" />
                <span className="text-xs text-[#333]">{result.trends.length} identificadas</span>
                <ExportBar result={result} type="trends" />
              </div>
              <div className="space-y-3">
                {[...result.trends]
                  .sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id))
                  .map(trend => <TrendCard key={trend.id} trend={trend} />)
                }
              </div>
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

          {/* Cuts */}
          {result.cuts && result.cuts.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xs tracking-widest uppercase text-[#444]">Cortes</h3>
                <div className="flex-1 border-t border-[#1a1a1a]" />
                {result.summary && (
                  <span className="text-xs text-[#333]">
                    {filteredCuts.length !== result.cuts.length
                      ? `${filteredCuts.length} de ${result.summary.totalCuts}`
                      : `${result.summary.totalCuts} identificados`
                    }
                  </span>
                )}
                <ExportBar cuts={result.cuts} result={result} type="analysis" />
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[#1a1a1a]">
                {/* Destino */}
                <div className="flex gap-1">
                  {(['TODOS', 'RUAN', 'OVERLENS', 'AMBOS'] as FilterDest[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setFilterDest(d)}
                      className={`px-2.5 py-1 text-xs border transition-colors ${
                        filterDest === d
                          ? 'border-[#444] text-[#e5e5e5]'
                          : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Score mínimo */}
                <div className="flex gap-1 ml-auto">
                  {([5, 7, 9] as FilterScore[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterScore(s)}
                      className={`px-2.5 py-1 text-xs border transition-colors ${
                        filterScore === s
                          ? 'border-[#444] text-[#e5e5e5]'
                          : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                      }`}
                    >
                      {s}+
                    </button>
                  ))}
                </div>

                {/* Tipo */}
                <div className="flex flex-wrap gap-1 w-full">
                  {(['TODOS', 'TENSÃO', 'INSIGHT', 'IMPACTO', 'DADO', 'HISTÓRIA', 'PROVOCAÇÃO', 'BASTIDOR'] as (FilterType)[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-2.5 py-1 text-xs border transition-colors ${
                        filterType === t
                          ? 'border-[#444] text-[#e5e5e5]'
                          : 'border-[#1a1a1a] text-[#444] hover:text-[#777] hover:border-[#333]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredCuts.length > 0
                  ? filteredCuts.map(cut => <CutCard key={cut.id} cut={cut} />)
                  : <p className="text-xs text-[#444] py-4">Nenhum corte com esses filtros.</p>
                }
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

        </div>
      )}
    </div>
  )
}
