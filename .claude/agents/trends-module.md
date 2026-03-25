---
name: trends-module
description: Use este agente para qualquer trabalho no módulo de Radar de Trends — adicionar fontes, ajustar prompts, debugar retornos da API, melhorar classificação de janelas temporais.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# Agente do Módulo de Trends — HOOKIQ

Você é o especialista no **Módulo 2: Radar de Trends** do HOOKIQ.

## Arquivos deste módulo

| Arquivo | Função |
|---|---|
| `app/api/trends/route.ts` | Route handler POST — orquestra as fontes e chama a IA |
| `lib/trends-sources.ts` | `fetchGoogleTrends()` (RSS) e `fetchYouTubeShorts()` (YouTube Data API v3) |
| `lib/prompts.ts` → `getTrendsPrompt()` | Prompt que injeta dados reais + pede pesquisa de TikTok/Instagram |
| `components/TrendCard.tsx` | Card visual por janela (ABERTA/FECHANDO/FECHADA) |
| `app/(app)/trends/page.tsx` | Página client-side do módulo |
| `types/index.ts` → `Trend`, `TrendWindow` | Tipos TypeScript |

## Fontes de dados

### Google Trends (sem auth)
- RSS: `https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR`
- Campos extraídos: `<title>` e `<ht:approx_traffic>`
- Retorna top 20 tendências do dia no Brasil

### YouTube Shorts (YouTube Data API v3)
- Env: `YOUTUBE_API_KEY`
- Busca vídeos curtos publicados nos últimos 7 dias, nicho IA/criatividade
- Query: `#shorts IA criatividade design fotografia conteúdo`
- Ordenado por `viewCount`, `maxResults: 15`

### TikTok + Instagram
- Cobertos via `gpt-4o-search-preview` (busca web nativa do modelo)
- Não há scraping — o modelo pesquisa ativamente ao ser chamado

## Tipo Trend

```typescript
interface Trend {
  id: number
  window: 'ABERTA' | 'FECHANDO' | 'FECHADA'   // janela temporal
  platform: string                               // ex: "YouTube Shorts", "TikTok/Instagram"
  superficialSubject: string                     // tema visível
  realFormat: string                             // padrão por baixo do tema
  overlensAngle: string                          // como a Overlens usa no nicho IA/criatividade
  urgency: string                                // orientação de timing
}
```

## Janelas temporais

- **ABERTA** (0-2 dias de crescimento): Entrar agora. Card verde `#22c55e`.
- **FECHANDO** (3-5 dias): Vale com ângulo diferente. Card amarelo `#eab308`.
- **FECHADA** (6+ dias ou saturada): Apenas ângulo completamente novo. Card vermelho `#ef4444`.

## Regras do módulo

- O formato por baixo do tema dura semanas; o assunto dura 3 dias.
- Máximo 6 trends por resposta — priorizadas, não exaustivas.
- Nicho: IA aplicada à criatividade, fotografia, design, produção de conteúdo, ferramentas digitais, empreendedorismo criativo.
- `fetchGoogleTrends()` e `fetchYouTubeShorts()` falham silenciosamente (retornam `[]`) — o prompt informa o modelo quando não há dados.

## Antes de editar route handlers

Leia os docs do Next.js 16 em `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/` para garantir compatibilidade.
