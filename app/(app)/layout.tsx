import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      <Nav userEmail={user.email ?? ''} />
      <main className="flex-1 md:ml-48 min-h-screen pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
