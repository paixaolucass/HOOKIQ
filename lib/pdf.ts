import { AnalysisResult } from '@/types'

const today = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; background: #fff; color: #111; padding: 48px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: 400; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 32px; }
  .divider { border: none; border-top: 1px solid #e5e5e5; margin: 32px 0; }
  .cut { margin-bottom: 40px; page-break-inside: avoid; }
  .cut-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .cut-id { font-size: 11px; color: #999; font-family: monospace; }
  .cut-type { font-size: 11px; font-family: monospace; font-weight: 700; padding: 2px 6px; border: 1px solid; }
  .cut-dest { font-size: 11px; font-weight: 600; }
  .cut-ts { font-size: 11px; color: #999; font-family: monospace; margin-left: auto; }
  .excerpt { font-size: 14px; line-height: 1.7; color: #333; border-left: 3px solid #ddd; padding-left: 16px; margin: 12px 0; font-style: italic; }
  .why-viral { font-size: 13px; line-height: 1.6; color: #555; margin-bottom: 20px; }
  .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 8px; margin-top: 16px; }
  .rhetoric-block { border: 1px solid #f0f0f0; padding: 16px; margin: 16px 0; }
  .rhetoric-row { margin-bottom: 12px; }
  .rhetoric-title { font-size: 11px; font-family: monospace; font-weight: 700; color: #111; display: inline; margin-right: 8px; }
  .rhetoric-score { font-size: 11px; color: #999; margin-right: 8px; }
  .rhetoric-emotion { font-size: 10px; border: 1px solid #ddd; padding: 1px 6px; display: inline-block; margin-right: 8px; }
  .rhetoric-analysis { font-size: 12px; color: #666; line-height: 1.6; margin-top: 4px; }
  .cta-block { background: #f9f9f9; padding: 12px 16px; margin-top: 12px; }
  .cta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
  .cta-text { font-size: 13px; font-weight: 600; color: #111; font-family: monospace; }
  .score-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .score-label { font-size: 11px; color: #888; min-width: 180px; }
  .score-dots { display: flex; gap: 3px; margin-top: 3px; }
  .score-dot { width: 8px; height: 8px; border-radius: 50%; background: #ddd; }
  .score-dot.filled { background: #111; }
  .score-reason { font-size: 11px; color: #777; line-height: 1.5; flex: 1; }
  .opening { background: #111; color: #fff; padding: 12px 16px; font-size: 13px; line-height: 1.6; margin-top: 12px; }
  .format-tip { font-size: 11px; color: #888; font-style: italic; margin-top: 8px; }
  /* PRODUÇÃO */
  .producao-block { border: 1px solid #f0f0f0; padding: 16px; margin-top: 16px; }
  .producao-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .producao-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; text-transform: uppercase; letter-spacing: 1px; }
  .producao-dur { font-size: 11px; color: #888; font-family: monospace; }
  .producao-titulo { font-size: 12px; color: #333; margin-bottom: 4px; }
  .producao-legenda { font-size: 12px; color: #555; line-height: 1.6; border-left: 3px solid #eee; padding-left: 10px; margin: 8px 0; }
  .hashtags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .hashtag { font-size: 10px; color: #888; border: 1px solid #e5e5e5; padding: 2px 6px; font-family: monospace; }
  /* TRENDS */
  .trend { margin-bottom: 32px; page-break-inside: avoid; border-left: 3px solid #ddd; padding-left: 20px; }
  .trend-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .trend-window { font-size: 10px; font-weight: 700; padding: 2px 8px; text-transform: uppercase; letter-spacing: 1px; }
  .trend-platform { font-size: 11px; color: #888; }
  .trend-subject { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .trend-format { font-size: 12px; color: #555; margin-bottom: 12px; }
  .trend-field { margin-bottom: 8px; }
  .trend-field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 2px; }
  .trend-field-value { font-size: 13px; color: #333; line-height: 1.5; }
  .summary-bar { display: flex; gap: 24px; background: #f5f5f5; padding: 16px 20px; margin-bottom: 32px; flex-wrap: wrap; }
  .summary-item { }
  .summary-num { font-size: 22px; font-weight: 700; }
  .summary-lab { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
  @media print { body { padding: 24px; } }
`

function dots(score: number, max = 2) {
  return Array.from({ length: max + 1 }, (_, i) =>
    `<div class="score-dot ${i < score ? 'filled' : ''}"></div>`
  ).join('')
}

function windowStyle(w: string) {
  if (w === 'ABERTA') return 'background:#dcfce7;color:#166534;'
  if (w === 'FECHANDO') return 'background:#fef9c3;color:#854d0e;'
  return 'background:#fee2e2;color:#991b1b;'
}

export function downloadAnalysisPDF(result: AnalysisResult) {
  const cuts = result.cuts ?? []
  const summary = result.summary

  const cutsHTML = cuts.map(cut => {
    const typeColor: Record<string, string> = {
      'TENSÃO':'#ef4444','INSIGHT':'#3b82f6','IMPACTO':'#a855f7',
      'DADO':'#22c55e','HISTÓRIA':'#f97316','PROVOCAÇÃO':'#eab308','BASTIDOR':'#64748b',
    }
    const destColor: Record<string, string> = { 'RUAN':'#3b82f6','OVERLENS':'#a855f7','AMBOS':'#22c55e' }
    const color = typeColor[cut.type] ?? '#111'
    const dc = destColor[cut.destination] ?? '#111'

    const rhetoricalHTML = cut.rhetorical ? `
      <div class="section-label">Retórica aristotélica</div>
      <div class="rhetoric-block">
        <div class="rhetoric-row">
          <span class="rhetoric-title">ETHOS</span>
          <span class="rhetoric-score">${cut.rhetorical.ethos.score}/2</span>
          <div class="rhetoric-analysis">${cut.rhetorical.ethos.analysis}</div>
        </div>
        <div class="rhetoric-row">
          <span class="rhetoric-title">PATHOS</span>
          <span class="rhetoric-score">${cut.rhetorical.pathos.score}/2</span>
          ${cut.rhetorical.pathos.emotion ? `<span class="rhetoric-emotion">${cut.rhetorical.pathos.emotion}</span>` : ''}
          <div class="rhetoric-analysis">${cut.rhetorical.pathos.analysis}</div>
        </div>
        <div class="rhetoric-row">
          <span class="rhetoric-title">LOGOS</span>
          <span class="rhetoric-score">${cut.rhetorical.logos.score}/2</span>
          <div class="rhetoric-analysis">${cut.rhetorical.logos.analysis}</div>
        </div>
        ${cut.rhetorical.cta ? `
        <div class="cta-block">
          <div class="cta-label">CTA</div>
          ${cut.rhetorical.cta.existing ? `<div style="font-size:11px;color:#888;margin-bottom:4px;">Existente: "${cut.rhetorical.cta.existing}"</div>` : ''}
          <div class="cta-text">"${cut.rhetorical.cta.suggested}"</div>
        </div>` : ''}
      </div>` : ''

    const breakdownHTML = cut.scoreBreakdown ? `
      <div class="section-label">Análise por critério</div>
      ${([
        ['Velocidade do gancho', cut.scoreBreakdown.hookSpeed],
        ['Independência de contexto', cut.scoreBreakdown.contextIndependence],
        ['Carga emocional', cut.scoreBreakdown.emotionalCharge],
        ['Poder de retenção', cut.scoreBreakdown.retentionPull],
        ['Alinhamento de nicho', cut.scoreBreakdown.nicheAlignment],
      ] as [string, typeof cut.scoreBreakdown.hookSpeed][]).map(([label, c]) => `
        <div class="score-row">
          <div class="score-label">
            ${label}<br>
            <div class="score-dots">${dots(c.score)}</div>
          </div>
          <div class="score-reason">${c.reason}</div>
        </div>`).join('')}
      ${cut.scoreBreakdown.dominantEmotion ? `<div style="font-size:11px;color:#888;margin-top:8px;">Emoção dominante: <strong>${cut.scoreBreakdown.dominantEmotion}</strong></div>` : ''}
    ` : ''

    return `
    <div class="cut">
      <div class="cut-header">
        <span class="cut-id">CORTE #${cut.id}</span>
        <span class="cut-type" style="color:${color};border-color:${color};">${cut.type}</span>
        <span class="cut-dest" style="color:${dc};">${cut.destination}</span>
        ${cut.timestamp ? `<span class="cut-ts">${cut.timestamp}</span>` : ''}
      </div>
      <div class="excerpt">${cut.excerpt}</div>
      <div class="why-viral">${cut.whyViral}</div>
      ${rhetoricalHTML}
      ${breakdownHTML}
      ${cut.hookJustification ? `<div class="section-label">Por que ${cut.type}</div><div style="font-size:12px;color:#666;line-height:1.6;margin-bottom:12px;">${cut.hookJustification}</div>` : ''}
      ${cut.formatTip ? `<div class="format-tip">Formato: ${cut.formatTip}</div>` : ''}
      ${cut.suggestedOpening ? `<div class="section-label" style="margin-top:16px;">Abertura sugerida</div><div class="opening">${cut.suggestedOpening}</div>` : ''}
      ${(cut.titulosAlternativos?.length || cut.legendaSugerida || cut.hashtags?.length || cut.duracaoEstimada || cut.producaoDificuldade) ? `
      <div class="section-label" style="margin-top:16px;">Produção</div>
      <div class="producao-block">
        <div class="producao-header">
          ${cut.producaoDificuldade ? (() => {
            const cfg: Record<string, string> = { SOLO: 'background:#dcfce7;color:#166534;', SIMPLES: 'background:#fef9c3;color:#854d0e;', 'PRODUÇÃO': 'background:#fee2e2;color:#991b1b;' }
            return `<span class="producao-badge" style="${cfg[cut.producaoDificuldade] ?? ''}">${cut.producaoDificuldade}</span>`
          })() : ''}
          ${cut.duracaoEstimada ? `<span class="producao-dur">⏱ ${cut.duracaoEstimada}</span>` : ''}
        </div>
        ${cut.titulosAlternativos?.length ? `
          <div class="section-label">Títulos</div>
          ${cut.titulosAlternativos.map((t, i) => `<div class="producao-titulo">${i + 1}. ${t}</div>`).join('')}
        ` : ''}
        ${cut.legendaSugerida ? `
          <div class="section-label" style="margin-top:10px;">Legenda</div>
          <div class="producao-legenda">${cut.legendaSugerida}</div>
        ` : ''}
        ${cut.hashtags?.length ? `
          <div class="hashtags">${cut.hashtags.map(h => `<span class="hashtag">${h}</span>`).join('')}</div>
        ` : ''}
      </div>` : ''}
    </div>`
  }).join('<hr class="divider">')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>HOOKIQ — Análise de Transcrição</title>
    <style>${BASE_STYLES}</style>
  </head><body>
    <h1>HOOKIQ — Análise de Transcrição</h1>
    <h2>${today()}</h2>
    ${summary ? `
    <div class="summary-bar">
      <div class="summary-item"><div class="summary-num">${summary.totalCuts}</div><div class="summary-lab">Cortes</div></div>
      <div class="summary-item"><div class="summary-num">${summary.forRuan}</div><div class="summary-lab">Ruan</div></div>
      <div class="summary-item"><div class="summary-num">${summary.forOverlens}</div><div class="summary-lab">Overlens</div></div>
      <div class="summary-item"><div class="summary-num">${summary.forBoth}</div><div class="summary-lab">Ambos</div></div>
      <div class="summary-item"><div class="summary-num">#${summary.topCutId}</div><div class="summary-lab">Top corte</div></div>
    </div>` : ''}
    ${result.alert ? `<div style="border:1px solid #f59e0b;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:24px;">${result.alert}</div>` : ''}
    ${cutsHTML}
  </body></html>`

  openPrint(html)
}

export function downloadTrendsPDF(result: AnalysisResult) {
  const trends = result.trends ?? []

  const trendsHTML = trends.map(trend => `
    <div class="trend">
      <div class="trend-header">
        <span class="trend-window" style="${windowStyle(trend.window)}">${trend.window}</span>
        <span class="trend-platform">${trend.platform}</span>
      </div>
      <div class="trend-subject">${trend.superficialSubject}</div>
      <div class="trend-format">Formato por baixo: ${trend.realFormat}</div>
      <div class="trend-field">
        <div class="trend-field-label">Ângulo Overlens</div>
        <div class="trend-field-value">${trend.overlensAngle}</div>
      </div>
      <div class="trend-field">
        <div class="trend-field-label">Urgência</div>
        <div class="trend-field-value">${trend.urgency}</div>
      </div>
    </div>
  `).join('<hr class="divider">')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>HOOKIQ — Radar de Trends</title>
    <style>${BASE_STYLES}</style>
  </head><body>
    <h1>HOOKIQ — Radar de Trends</h1>
    <h2>${today()}</h2>
    <div class="summary-bar">
      <div class="summary-item"><div class="summary-num">${trends.length}</div><div class="summary-lab">Trends identificadas</div></div>
      <div class="summary-item"><div class="summary-num">${trends.filter(t => t.window === 'ABERTA').length}</div><div class="summary-lab">Abertas</div></div>
      <div class="summary-item"><div class="summary-num">${trends.filter(t => t.window === 'FECHANDO').length}</div><div class="summary-lab">Fechando</div></div>
      <div class="summary-item"><div class="summary-num">${trends.filter(t => t.window === 'FECHADA').length}</div><div class="summary-lab">Fechadas</div></div>
    </div>
    ${trendsHTML}
  </body></html>`

  openPrint(html)
}

function openPrint(html: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => {
    w.focus()
    w.print()
  }
}
