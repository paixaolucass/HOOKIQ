'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs text-[#555] tracking-widest uppercase mb-2">Overlens</div>
        <h1 className="text-2xl font-bold tracking-tight">HOOKIQ</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-[#111] border border-[#222] text-[#e5e5e5] px-4 py-3 text-sm outline-none focus:border-[#444] transition-colors placeholder:text-[#444]"
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-[#111] border border-[#222] text-[#e5e5e5] px-4 py-3 text-sm outline-none focus:border-[#444] transition-colors placeholder:text-[#444]"
          />
        </div>

        {error && (
          <p className="text-[#ef4444] text-xs">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black py-3 text-sm font-medium hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

    </div>
  )
}
