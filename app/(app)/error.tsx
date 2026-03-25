'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="border border-[#ef4444] bg-[#0d0d0d] p-6 space-y-4">
        <p className="text-xs text-[#ef4444] uppercase tracking-widest">Erro</p>
        <p className="text-sm text-[#aaa]">{error.message || 'Algo deu errado ao carregar esta página.'}</p>
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="text-xs border border-[#222] text-[#555] hover:text-[#e5e5e5] px-3 py-1.5 transition-colors"
          >
            Tentar novamente
          </button>
          <Link href="/trends" className="text-xs text-[#444] hover:text-[#e5e5e5] transition-colors py-1.5">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
