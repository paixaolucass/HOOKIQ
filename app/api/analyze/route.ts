import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { HOOKIQ_SYSTEM_PROMPT, ANALYZE_PROMPT, getCrossReferencePrompt, getRoteiroPrompt } from '@/lib/prompts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const user = session.user

    const body = await request.json()
    const { mode, transcription, cuts, trends, cut } = body

    let userPrompt: string

    if (mode === 'cross') {
      userPrompt = getCrossReferencePrompt(cuts, trends)
    } else if (mode === 'roteiro') {
      userPrompt = getRoteiroPrompt(cut)
    } else {
      userPrompt = `${ANALYZE_PROMPT}\n\nTRANSCRIÇÃO:\n${transcription ?? ''}`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: HOOKIQ_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 5000,
    })

    const result = JSON.parse(completion.choices[0].message.content ?? '{}')

    // Save to history (only for transcription analysis, not cross-reference or roteiro)
    if (mode !== 'cross' && mode !== 'roteiro') {
      await supabase.from('sessions').insert({
        user_id: user.id,
        type: 'transcription',
        input: transcription?.slice(0, 2000),
        result,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erro ao processar análise' }, { status: 500 })
  }
}
