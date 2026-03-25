'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Zap, TrendingUp, History, LogOut } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Análise', icon: Zap },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/historico', label: 'Histórico', icon: History },
]

export default function Nav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-48 border-r border-[#1a1a1a] flex flex-col bg-[#0a0a0a]">
      <div className="px-5 py-6 border-b border-[#1a1a1a]">
        <div className="text-xs text-[#444] tracking-widest uppercase mb-1">Overlens</div>
        <div className="font-bold text-sm tracking-wide">HOOKIQ</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'text-white bg-[#1a1a1a]'
                  : 'text-[#555] hover:text-[#e5e5e5]'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#1a1a1a]">
        <div className="text-xs text-[#333] truncate mb-3">{userEmail}</div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-[#444] hover:text-[#e5e5e5] transition-colors"
        >
          <LogOut size={12} />
          Sair
        </button>
      </div>
    </aside>
  )
}
