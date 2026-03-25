import { createClient } from '@/lib/supabase/client'
import type { TrendComment, TrendAssignment } from '@/types'

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(
  trendId: number,
  fetchedAt: string,
  text: string,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const now = new Date().toISOString()
  await supabase.from('sessions').insert({
    user_id: user.id,
    type: 'trend_comment',
    result: {
      trendId,
      trendFetchedAt: fetchedAt,
      userId: user.id,
      userEmail: user.email ?? '',
      text,
      createdAt: now,
    },
  })
}

export async function getComments(
  trendId: number,
  fetchedAt: string,
): Promise<TrendComment[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('sessions')
    .select('id, result, created_at')
    .eq('type', 'trend_comment')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data
    .filter(row =>
      row.result?.trendId === trendId &&
      row.result?.trendFetchedAt === fetchedAt,
    )
    .map(row => ({
      id: row.id,
      trendId: row.result.trendId,
      trendFetchedAt: row.result.trendFetchedAt,
      userId: row.result.userId,
      userEmail: row.result.userEmail,
      text: row.result.text,
      createdAt: row.result.createdAt ?? row.created_at,
    }))
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function assignTrend(
  trendId: number,
  fetchedAt: string,
  assignment: TrendAssignment,
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Check if a row already exists (shared across team — no user_id filter)
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('type', 'trend_assignment')
    .filter('result->trendId', 'eq', trendId)
    .filter('result->trendFetchedAt', 'eq', fetchedAt)
    .maybeSingle()

  const payload = {
    user_id: user.id,
    type: 'trend_assignment',
    result: { trendId, trendFetchedAt: fetchedAt, assignment },
  }

  if (existing?.id) {
    await supabase.from('sessions').update({ result: payload.result }).eq('id', existing.id)
  } else {
    await supabase.from('sessions').insert(payload)
  }
}

export async function getAssignment(
  trendId: number,
  fetchedAt: string,
): Promise<TrendAssignment> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('sessions')
    .select('result')
    .eq('type', 'trend_assignment')
    .filter('result->trendId', 'eq', trendId)
    .filter('result->trendFetchedAt', 'eq', fetchedAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.result) return null
  return (data.result as { assignment: TrendAssignment }).assignment ?? null
}
