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

export interface Trend {
  id: number
  window: TrendWindow
  platform: string
  superficialSubject: string
  realFormat: string
  overlensAngle: string
  urgency: string
}

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
  type: 'transcription' | 'trends' | 'full'
  input?: string
  result: AnalysisResult
  created_at: string
}
