export type HookType = 'TENSÃO' | 'INSIGHT' | 'IMPACTO' | 'DADO' | 'HISTÓRIA' | 'PROVOCAÇÃO' | 'BASTIDOR'
export type Destination = 'RUAN' | 'OVERLENS' | 'AMBOS'
export type TrendWindow = 'ABERTA' | 'FECHANDO' | 'FECHADA'

export interface ScoreCriterion {
  score: number  // 0-2
  reason: string // justificativa completa
}

export interface ScoreBreakdown {
  hookSpeed: ScoreCriterion
  contextIndependence: ScoreCriterion
  emotionalCharge: ScoreCriterion
  retentionPull: ScoreCriterion
  nicheAlignment: ScoreCriterion
  dominantEmotion: string
}

export interface RhetoricalAnalysis {
  ethos: {
    score: number   // 0-2: o quão forte é a credibilidade estabelecida
    analysis: string // o que especificamente estabelece (ou não) autoridade
  }
  pathos: {
    score: number   // 0-2: intensidade do impacto emocional
    emotion: string  // emoção específica ativada
    analysis: string // como faz a pessoa se sentir e por quê
  }
  logos: {
    score: number   // 0-2: poder de convencimento lógico
    analysis: string // quais argumentos ou evidências convencem
  }
  cta: {
    existing: string | null  // CTA que já existe no trecho (null se não houver)
    suggested: string        // CTA sugerido para colocar ao final do corte
  }
}

export type ProducaoDificuldade = 'SOLO' | 'SIMPLES' | 'PRODUÇÃO'

export interface Cut {
  id: number
  score: number
  type: HookType
  destination: Destination
  excerpt: string
  whyViral: string
  suggestedOpening: string
  formatTip?: string
  timestamp?: string
  hookJustification?: string
  scoreBreakdown?: ScoreBreakdown
  rhetorical?: RhetoricalAnalysis
  // Campos de produção
  titulosAlternativos?: string[]
  legendaSugerida?: string
  hashtags?: string[]
  duracaoEstimada?: string
  producaoDificuldade?: ProducaoDificuldade
  // Roteiro gerado sob demanda
  roteiro?: Roteiro
}

export interface TrendRhetoric {
  ethos: { score: number; analysis: string }
  pathos: { score: number; emotion: string; analysis: string }
  logos: { score: number; analysis: string }
}

export interface SaturationEstimate {
  daysRemaining: number
  competitorVolume: 'baixo' | 'médio' | 'alto'
  recommendation: 'entrar agora' | 'entrar com ângulo diferente' | 'evitar'
}

export interface Trend {
  id: number
  window: TrendWindow
  platform: string
  originCountry?: 'EUA' | 'Brasil' | 'Global' | 'Europa'
  superficialSubject: string
  realFormat: string
  overlensAngle: string
  urgency: string
  rank?: number
  rankScore?: number
  rankJustification?: string
  hookAngle?: string
  hookAngles?: string[]
  executionTip?: string
  publishingTip?: string
  saturationEstimate?: SaturationEstimate
  rhetoric?: TrendRhetoric
  isNew?: boolean
  profile?: 'ruan' | 'overlens'
  seasonalConnection?: string
  referenceVideos?: string[]
  trendSource?: string
}

export interface MetaTrend {
  theme: string
  description: string
  trendIds: number[]
  overlensOpportunity: string
}

export interface TrendsResult {
  trends: Trend[]
  metaTrend?: MetaTrend
}

export interface PerformanceData {
  platform: string
  views24h?: number
  engagement: 'abaixo' | 'esperado' | 'acima'
  notes?: string
  recordedAt: string
}

export interface SavedTrend {
  id: string
  userId: string
  trend: Trend
  profile?: 'ruan' | 'overlens'
  status: 'salva' | 'gravando' | 'publicada'
  savedAt: string
  updatedAt: string
  performanceData?: PerformanceData
}

export interface TrendComment {
  id: string
  trendId: number
  trendFetchedAt: string
  userId: string
  userEmail: string
  text: string
  createdAt: string
}

export type TrendAssignment = 'ruan' | 'overlens' | null

export interface CombinedOpportunity {
  cutId: number
  trendName: string
  executionSuggestion: string
}

export interface AnalysisSummary {
  totalCuts: number
  forRuan: number
  forOverlens: number
  forBoth: number
  topCutId: number
}

export interface AnalysisResult {
  cuts?: Cut[]
  trends?: Trend[]
  opportunities?: CombinedOpportunity[]
  summary?: AnalysisSummary
  alert?: string
}

export interface Roteiro {
  abertura: string
  desenvolvimento: string[]
  fechamento: string
  observacoes?: string
}

export interface Session {
  id: string
  user_id: string
  type: 'transcription' | 'trends' | 'full' | 'trends_data' | 'trends_data_ruan' | 'trends_data_overlens' | 'trends_social' | 'trends_social_ruan' | 'trends_social_overlens' | 'saved_trend'
  input?: string
  result: AnalysisResult & { trend?: Trend; status?: string; profile?: 'ruan' | 'overlens'; performanceData?: PerformanceData }
  created_at: string
}
