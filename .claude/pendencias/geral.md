# Pendências Gerais — HOOKIQ

## Sistema

### Variáveis de ambiente necessárias (Vercel + local)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
YOUTUBE_API_KEY
```
Valores estão no arquivo local `APIS USADAS.txt` (não commitado por segurança).

### Stack
- Next.js 16.2.1 (usa `proxy.ts` como middleware — NÃO `middleware.ts`)
- Supabase Auth (usar `getSession()` em route handlers, `getUser()` em server components)
- OpenAI SDK v6: `gpt-4o-mini` para análise, `gpt-4o-mini-search-preview` para busca social
- Tailwind v4 (sem `tailwind.config.js`)

---

## Análise de Transcrição

### Pendências
- [ ] Verificar se o offset de timestamp está sendo aplicado corretamente em transcrições reais
- [ ] Testar com transcrição longa (+1h) para confirmar que extrai 10–15+ cortes
- [ ] O roteiro por corte não aparece no PDF — seria útil incluir opcionalmente

### Regra de timesetting (importante)
Transcrições começam com offset — ex: `00:04:42`. Todo timestamp do corte =
timestamp bruto − offset. Regra já está no `ANALYZE_PROMPT` em `lib/prompts.ts`.

---

## PDF Export

### Pendências
- [ ] Roteiro gerado sob demanda não é incluído no PDF (foi adicionado depois do PDF)
- [ ] Títulos alternativos estão no PDF mas não têm formatação de lista visual clara

---

## Histórico

### Funcionamento atual
- Lista em `/historico` — últimas 50 sessões
- Detalhe em `/historico/[id]` — abre resultado completo com CutCards e TrendCards
- Supabase salva: `user_id`, `type`, `input` (primeiros 2000 chars), `result` (JSON completo)

### Pendências
- [ ] Busca/filtro no histórico (hoje não tem, fica difícil com muitas sessões)
- [ ] Modo Full salva como `type: 'transcription'` — não distingue Full de Transcrição simples
- [ ] Título da sessão (hoje mostra só "Transcrição" sem contexto do conteúdo)

---

## Referência Overlens

Sempre usar os manuais em `Manuais/` como referência editorial e de produto:

- `[O] Overview da Overlens.txt` — visão geral da Overlens, missão, produtos
- `[O] [LXP] Manual da Vanguarda.txt` — manual do produto Vanguarda
- `[O] [LXP] Manual do Overpass.txt` — manual do produto Overpass
- `Manual da Metodologia Overlens.docx` — metodologia editorial completa
- `Glossário da Vanguarda.docx` — glossário e termos próprios da Vanguarda

Esses manuais são a fonte de verdade para linguagem, personas, produtos e posicionamento da Overlens. Qualquer prompt de IA, análise ou sugestão editorial deve estar alinhada com eles.

---

## Agentes Claude (.claude/agents/)

Quatro agentes especializados disponíveis:
- `hookiq-dev.md` — desenvolvimento geral
- `trends-module.md` — trabalho no módulo de trends
- `editorial-prompts.md` — edição de prompts de IA
- `overlens-context.md` — contexto Overlens, produtos, personas

Manuais em `Manuais/` — usados pelos agentes como referência.

---

## Custos estimados (3 pessoas, uso moderado)

| Item | Custo/mês |
|---|---|
| Análise de transcrição (~60/mês) | ~$0.30 |
| Trends (cache 4h compartilhado) | ~$0.15 |
| Roteiros gerados (~30/mês) | ~$0.06 |
| Cross-reference full mode | ~$0.10 |
| **Total estimado** | **~$0.60/mês** |

---

## Deploy

- GitHub: `https://github.com/paixaolucas/HOOKIQ`
- Vercel: conectado ao repositório, auto-deploy em push na branch `main`
- Build command: `npm run build` (Next.js detectado automaticamente)
