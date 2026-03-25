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
      <main className="flex-1 ml-48 min-h-screen">
        {children}
      </main>
    </div>
  )
}
