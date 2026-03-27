'use client'

import { useEffect, useState } from 'react'
import { timeAgo, remainingTime, isDataCacheValid, isSocialCacheValid, DATA_CACHE_TTL, SOCIAL_CACHE_TTL, loadDataCache, loadSocialCache, isAnyCacheExpired } from '@/lib/trends-cache'

interface CacheStatusProps {
  profile: 'ruan' | 'overlens'
  onRefresh: () => void
  className?: string
}

function CacheRow({ label, fetchedAt, valid, ttlMs }: { label: string; fetchedAt: string | null; valid: boolean; ttlMs: number }) {
  if (!fetchedAt) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#333] flex-shrink-0" />
          <span className="text-xs text-[#444] uppercase tracking-wide w-20">{label}</span>
          <span className="text-sm text-[#444]">—</span>
        </div>
        <span className="text-xs text-[#333]">sem dados</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${valid ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
        <span className="text-xs text-[#555] uppercase tracking-wide w-20">{label}</span>
        {valid
          ? <span className="text-sm font-medium text-[#22c55e]">{remainingTime(fetchedAt, ttlMs)}</span>
          : <span className="text-sm font-medium text-[#ef4444]">expirado</span>
        }
      </div>
      <span className="text-xs text-[#444]">buscado {timeAgo(fetchedAt)}</span>
    </div>
  )
}

async function clearAllCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('hookiq_trends'))
    .forEach(k => localStorage.removeItem(k))
  await fetch('/api/trends/reset', { method: 'POST' })
}

export default function CacheStatus({ profile, onRefresh, className = 'mb-10' }: CacheStatusProps) {
  const [tick, setTick] = useState(0)
  const [clearing, setClearing] = useState(false)

  // Re-render every 30s to keep times live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const dataEntry   = loadDataCache(profile)
  const socialEntry = loadSocialCache(profile)
  const dataFetchedAt   = dataEntry?.fetchedAt   ?? null
  const socialFetchedAt = socialEntry?.fetchedAt ?? null

  const hasAny      = !!(dataFetchedAt || socialFetchedAt)
  const dataValid   = dataFetchedAt   ? isDataCacheValid(dataFetchedAt)     : false
  const socialValid = socialFetchedAt ? isSocialCacheValid(socialFetchedAt) : false
  const expired     = isAnyCacheExpired(profile)

  // tick used only to trigger re-render — suppress lint warning
  void tick

  if (!hasAny) {
    return (
      <div className={`${className} border border-[#1a1a1a] px-5 py-4 flex items-center justify-between gap-6`}>
        <div>
          <p className="text-xs text-[#444] uppercase tracking-widest mb-1">Cache</p>
          <p className="text-sm text-[#555]">Nenhuma busca realizada ainda</p>
        </div>
        <p className="text-xs text-[#333] text-right">
          Resultado salvo por <span className="text-[#e5e5e5]">12h</span> após buscar.<br />
          Navegar entre abas não gera custo.
        </p>
      </div>
    )
  }

  return (
    <div className={`${className} border ${expired ? 'border-[#ef4444]/40' : 'border-[#22c55e]/20'} px-5 py-4`}>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2.5 flex-1">
          <p className={`text-xs uppercase tracking-widest mb-3 ${expired ? 'text-[#ef4444]/60' : 'text-[#22c55e]/60'}`}>
            {expired ? 'Cache expirado' : 'Cache ativo'}
          </p>
          <CacheRow label="Dados"  fetchedAt={dataFetchedAt}   valid={dataValid}   ttlMs={DATA_CACHE_TTL} />
          <CacheRow label="Social" fetchedAt={socialFetchedAt} valid={socialValid} ttlMs={SOCIAL_CACHE_TTL} />
        </div>
        <div className="flex flex-col gap-2 items-end self-end">
          {expired && (
            <button
              onClick={onRefresh}
              className="text-xs text-[#ef4444] border border-[#ef4444]/40 px-3 py-1 hover:bg-[#ef4444]/10 transition-colors"
            >
              atualizar agora
            </button>
          )}
          {hasAny && (
            <button
              onClick={async () => {
                setClearing(true)
                await clearAllCache()
                setClearing(false)
                setTick(t => t + 1)
              }}
              disabled={clearing}
              className="text-xs text-[#333] border border-[#222] px-3 py-1 hover:text-[#aaa] hover:border-[#444] transition-colors disabled:opacity-40"
            >
              {clearing ? 'limpando...' : 'limpar cache'}
            </button>

          )}
        </div>
      </div>
    </div>
  )
}
