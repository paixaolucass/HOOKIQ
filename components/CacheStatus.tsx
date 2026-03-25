'use client'

import { timeAgo, remainingTime } from '@/lib/trends-cache'

interface CacheStatusProps {
  fetchedAt: string | null
  expired: boolean
  onRefresh: () => void
  className?: string
}

export default function CacheStatus({ fetchedAt, expired, onRefresh, className = 'mb-10' }: CacheStatusProps) {
  if (!fetchedAt) {
    return (
      <div className={`${className} border border-[#1a1a1a] px-5 py-4 flex items-center justify-between gap-6`}>
        <div>
          <p className="text-xs text-[#444] uppercase tracking-widest mb-1">Cache</p>
          <p className="text-sm text-[#555]">Nenhuma busca realizada ainda</p>
        </div>
        <p className="text-xs text-[#333] text-right">
          Resultado salvo por <span className="text-[#e5e5e5]">4h</span> após buscar.<br />
          Navegar entre abas não gera custo.
        </p>
      </div>
    )
  }

  if (expired) {
    return (
      <div className={`${className} border border-[#ef4444]/40 px-5 py-4 flex items-center justify-between gap-6`}>
        <div>
          <p className="text-xs text-[#ef4444]/60 uppercase tracking-widest mb-1">Cache expirado</p>
          <p className="text-2xl font-bold text-[#ef4444]">4h esgotadas</p>
          <p className="text-xs text-[#555] mt-1">buscado {timeAgo(fetchedAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#555] mb-2">
            Próxima busca chama a IA.<br />
            Novo cache de 4h será criado.
          </p>
          <button
            onClick={onRefresh}
            className="text-xs text-[#ef4444] border border-[#ef4444]/40 px-3 py-1 hover:bg-[#ef4444]/10 transition-colors"
          >
            atualizar agora
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} border border-[#22c55e]/30 px-5 py-4 flex items-center justify-between gap-6`}>
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
  )
}
