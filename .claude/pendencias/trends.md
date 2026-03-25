# Pendências e Melhorias — Módulo de Trends

## CRÍTICO — Ranking unificado (não implementado)

Hoje o sistema retorna dois grupos separados:
- Google/YouTube: IDs 1–5, rank 1–5
- TikTok/Instagram: IDs 6–10, rank 6–10

**Problema:** Uma trend social nunca vai ser `#1` mesmo sendo melhor que todas as outras.

**Solução:** Após combinar os dois grupos na rota `/api/trends/route.ts`, fazer um re-ranking global de 1–10 por `rankScore`. Código está em `app/api/trends/route.ts` — após o merge das duas listas, ordenar por `rankScore` e reatribuir `rank` de 1 a 10.

```typescript
// Em app/api/trends/route.ts, após combinar allTrends:
const reranked = allTrends
  .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
  .map((t, i) => ({ ...t, rank: i + 1 }))
```

---

## ALTO IMPACTO — Campos faltando nos prompts de trends

Adicionar em `lib/prompts.ts` para AMBOS os prompts (`getDataTrendsPrompt` e `SOCIAL_TRENDS_PROMPT`):

### `hookAngle` — Abertura pronta para gravar
Hoje a trend diz o ângulo da Overlens de forma genérica. Falta uma frase de abertura
pronta para o criador gravar. Modelo do ANALYZE_PROMPT que já faz isso para cortes.

```
hookAngle: "frase de abertura pronta para usar nessa trend — direto no gancho, sem saudação"
```

### `executionTip` — Como executar de forma concreta
Hoje o `overlensAngle` é genérico. Falta instrução prática.

```
executionTip: "como executar em 1–2 frases: formato, duração, o que mostrar, como abrir"
```

### `formatSpec` — Specs por plataforma
```
formatSpec: {
  duration: "15–30s",      // duração ideal para essa trend nessa plataforma
  hook: "primeiros 2s",    // o que precisa aparecer nos primeiros X segundos
  cta: "salva esse vídeo"  // CTA natural para esse formato
}
```

---

## MÉDIO IMPACTO — Análise de retórica mais profunda

Os campos de retórica existem (`ethos/pathos/logos`) mas as justificativas estão
sendo retornadas curtas. Adicionar instrução explícita nos prompts:

```
Para cada dimensão retórica, a análise deve ter no mínimo 2 frases:
- O que especificamente nesse FORMATO (não no assunto) cria esse efeito
- Como o criador da Overlens pode potencializar esse efeito ao executar
```

---

## MÉDIO IMPACTO — Saturação estimada

Adicionar campo `saturationEstimate` por trend:

```typescript
saturationEstimate: {
  daysRemaining: number,     // estimativa de dias antes de saturar
  competitorVolume: "baixo" | "médio" | "alto",  // quantos criadores já cobriram
  recommendation: "entrar agora" | "entrar com ângulo diferente" | "evitar"
}
```

Adicionar ao prompt: "Estime quantos dias até essa trend saturar no Brasil e o volume
de criadores já cobrindo. Baseie na janela temporal e nos dados disponíveis."

---

## BAIXO IMPACTO (mas útil) — Histórico de trends

Hoje cada busca é independente — não sabe se uma trend apareceu semana passada.

**Solução futura:** Ao salvar no Supabase (`sessions` table), comparar com a última
sessão de trends e marcar as que são novas vs recorrentes.

Campo sugerido: `isNew: boolean` e `appearedBefore: boolean`.

---

## Contexto técnico importante

- Prompts de trends: `lib/prompts.ts` — funções `getDataTrendsPrompt` e `SOCIAL_TRENDS_PROMPT`
- Rota de trends: `app/api/trends/route.ts`
- Dois modelos em paralelo:
  - `gpt-4o-mini` — analisa dados reais do Google Trends RSS + YouTube Data API v3
  - `gpt-4o-mini-search-preview` — busca em tempo real TikTok + Instagram
- Cache: 4h localStorage (client) + Supabase `sessions` table (server)
- Tipos: `types/index.ts` — interfaces `Trend`, `TrendRhetoric`
- Componente: `components/TrendCard.tsx` — card expandível com rank + retórica
- Fontes reais: `lib/trends-sources.ts` — `fetchGoogleTrends()` e `fetchYouTubeShorts()`

---

## Ordem de prioridade recomendada

1. Ranking global unificado (crítico, 10 min de código)
2. `hookAngle` nos prompts (alto impacto, 15 min)
3. `executionTip` nos prompts (alto impacto, 10 min)
4. Retórica com justificativas mais profundas (médio, 10 min)
5. `saturationEstimate` (médio, 20 min)
6. Histórico de trends (baixo, requer trabalho no Supabase)
