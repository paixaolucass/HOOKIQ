import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'
import { fetchGoogleTrends, fetchYouTubeShorts, fetchAITrends, fetchHackerNewsTrends, fetchRedditBrTrends } from '@/lib/trends-sources'
import OpenAI from 'openai'
import { HOOKIQ_SYSTEM_PROMPT, getDataTrendsPromptForProfile } from '@/lib/prompts'
import type { Trend } from '@/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function buildEmailHtml(trends: Trend[], appUrl: string): string {
  const dateStr = formatDate()
  const windowColor = (w: Trend['window']) =>
    w === 'ABERTA' ? '#22c55e' : w === 'FECHANDO' ? '#eab308' : '#ef4444'

  const trendRows = trends.map(t => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #1a1a1a;">
        <div style="margin-bottom:6px;">
          <span style="font-size:10px;font-weight:bold;color:${windowColor(t.window)};border:1px solid ${windowColor(t.window)}40;padding:2px 6px;letter-spacing:2px;text-transform:uppercase;">${t.window}</span>
          <span style="font-size:11px;color:#555;margin-left:10px;">${t.platform}</span>
        </div>
        <p style="margin:0 0 4px;font-size:15px;color:#e5e5e5;font-weight:600;">${t.superficialSubject}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#888;">Formato: ${t.realFormat}</p>
        ${t.hookAngle ? `<p style="margin:0 0 6px;font-size:12px;color:#aaa;font-style:italic;">"${t.hookAngle}"</p>` : ''}
        ${t.executionTip ? `<p style="margin:0;font-size:11px;color:#666;">Como executar: ${t.executionTip}</p>` : ''}
      </td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #1a1a1a;">
              <p style="margin:0 0 4px;font-size:10px;color:#444;letter-spacing:3px;text-transform:uppercase;">Overlens</p>
              <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;">HOOKIQ</p>
              <p style="margin:0;font-size:13px;color:#555;">Radar de Trends — ${dateStr}</p>
            </td>
          </tr>

          <!-- Subtitle -->
          <tr>
            <td style="padding:20px 0 8px;">
              <p style="margin:0;font-size:12px;color:#444;letter-spacing:2px;text-transform:uppercase;">${trends.length} trend${trends.length !== 1 ? 's' : ''} com janela aberta</p>
            </td>
          </tr>

          <!-- Trends -->
          <table width="100%" cellpadding="0" cellspacing="0">
            ${trendRows}
          </table>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid #1a1a1a;margin-top:24px;">
              <a href="${appUrl}/trends" style="display:inline-block;padding:10px 20px;background:#e5e5e5;color:#0a0a0a;font-size:12px;font-weight:600;text-decoration:none;letter-spacing:1px;">
                Ver todas as trends
              </a>
              <p style="margin:16px 0 0;font-size:10px;color:#333;">HOOKIQ — sistema editorial Overlens</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const userEmail = session.user.email
    if (!userEmail) {
      return NextResponse.json({ error: 'Email do usuário não encontrado' }, { status: 400 })
    }

    // Fetch trends data
    const [googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends] = await Promise.all([
      fetchGoogleTrends().catch(() => [] as Awaited<ReturnType<typeof fetchGoogleTrends>>),
      fetchYouTubeShorts().catch(() => [] as Awaited<ReturnType<typeof fetchYouTubeShorts>>),
      fetchAITrends().catch(() => [] as Awaited<ReturnType<typeof fetchAITrends>>),
      fetchHackerNewsTrends().catch(() => [] as Awaited<ReturnType<typeof fetchHackerNewsTrends>>),
      fetchRedditBrTrends().catch(() => [] as Awaited<ReturnType<typeof fetchRedditBrTrends>>),
    ])

    let trends: Trend[] = []
    try {
      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
          { role: 'user', content: getDataTrendsPromptForProfile('overlens', googleTrends, youtubeShorts, aiShorts, hnTrends, redditTrends) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 4000,
      })
      const raw = result.choices[0].message.content ?? '{"trends":[]}'
      const parsed = JSON.parse(raw)
      trends = Array.isArray(parsed.trends) ? parsed.trends as Trend[] : []
    } catch (e) {
      console.error('[notify] OpenAI falhou:', e instanceof Error ? e.message : String(e))
    }

    const openTrends = trends.filter(t => t.window === 'ABERTA')

    if (openTrends.length === 0) {
      return NextResponse.json({ sent: false, count: 0, reason: 'Nenhuma trend ABERTA encontrada' })
    }

    // Send email via SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT ?? 587),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
      to: userEmail,
      subject: `[${openTrends.length}] trends abertas hoje — HOOKIQ`,
      html: buildEmailHtml(openTrends, appUrl),
    })

    return NextResponse.json({ sent: true, count: openTrends.length })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[notify] Erro:', msg)
    return NextResponse.json({ error: 'Erro ao enviar email', details: msg }, { status: 500 })
  }
}
