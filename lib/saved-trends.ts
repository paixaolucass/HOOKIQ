import { createClient } from '@/lib/supabase/client'
import type { Trend, SavedTrend, PerformanceData } from '@/types'

export async function saveTrend(trend: Trend, profile?: 'ruan' | 'overlens'): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const now = new Date().toISOString()
  await supabase.from('sessions').insert({
    user_id: user.id,
    type: 'saved_trend',
    result: {
      trend,
      profile,
      status: 'salva',
      savedAt: now,
      updatedAt: now,
    },
  })
}

export async function getSavedTrends(): Promise<SavedTrend[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'saved_trend')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    trend: row.result.trend as Trend,
    profile: row.result.profile as 'ruan' | 'overlens' | undefined,
    status: (row.result.status ?? 'salva') as SavedTrend['status'],
    savedAt: row.result.savedAt ?? row.created_at,
    updatedAt: row.result.updatedAt ?? row.created_at,
    performanceData: row.result.performanceData as PerformanceData | undefined,
  }))
}

export async function updateTrendStatus(
  id: string,
  status: SavedTrend['status'],
): Promise<void> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('sessions')
    .select('result')
    .eq('id', id)
    .single()

  if (!row) return

  await supabase
    .from('sessions')
    .update({
      result: {
        ...row.result,
        status,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', id)
}

export async function savePerformanceData(
  id: string,
  performanceData: PerformanceData,
): Promise<void> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('sessions')
    .select('result')
    .eq('id', id)
    .single()

  if (!row) return

  await supabase
    .from('sessions')
    .update({
      result: {
        ...row.result,
        performanceData,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', id)
}

export function getPerformanceStats(items: SavedTrend[]): {
  total: number
  acima: number
  esperado: number
  abaixo: number
  avgViews: number
} {
  const withData = items.filter(i => i.performanceData)
  const acima    = withData.filter(i => i.performanceData!.engagement === 'acima').length
  const esperado = withData.filter(i => i.performanceData!.engagement === 'esperado').length
  const abaixo   = withData.filter(i => i.performanceData!.engagement === 'abaixo').length
  const viewsArr = withData.filter(i => i.performanceData!.views24h != null).map(i => i.performanceData!.views24h!)
  const avgViews = viewsArr.length > 0 ? Math.round(viewsArr.reduce((a, b) => a + b, 0) / viewsArr.length) : 0
  return { total: withData.length, acima, esperado, abaixo, avgViews }
}
