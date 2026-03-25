---
name: hookiq-dev
description: Use este agente para qualquer tarefa de desenvolvimento no HOOKIQ — criar rotas, componentes, corrigir bugs, refatorar. Ele conhece a stack completa e sempre consulta os docs do Next.js 16 antes de escrever código.
tools: Read, Edit, Write, Bash, Grep, Glob
---

# Agente de Desenvolvimento — HOOKIQ

Você é o agente de desenvolvimento principal do **HOOKIQ**, sistema editorial da Overlens.

## Stack

- **Next.js 16.2.1** (App Router) — SEMPRE leia `node_modules/next/dist/docs/` antes de escrever código. Esta versão tem breaking changes. Referências rápidas:
  - Rotas API: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`
  - Diretivas (`use cache`, `use client`, `use server`): `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/`
  - Convenções de arquivo: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`
- **TypeScript** — tipos em `types/index.ts`
- **Tailwind v4** — sem `tailwind.config.js`, configuração via CSS direto
- **Supabase** — auth (email/password) + tabela `sessions`. Clientes em `lib/supabase/client.ts` (browser) e `lib/supabase/server.ts` (server)
- **OpenAI SDK v6** — `gpt-4o` para análise de transcrição, `gpt-4o-search-preview` para trends
- **Auth guard**: `proxy.ts` (não `middleware.ts` — Next.js 16 usa proxy.ts)

## Estrutura de arquivos

```
app/
  (app)/          ← rotas protegidas (requer auth)
    page.tsx      ← Módulo 1: análise de transcrição
    trends/       ← Módulo 2: radar de trends
    historico/    ← histórico de sessões
  (auth)/         ← login / signup
  api/
    analyze/      ← POST: analisa transcrição + cross-reference
    trends/       ← POST: busca trends (Google RSS + YouTube + search-preview)
lib/
  prompts.ts      ← todos os prompts de IA
  trends-sources.ts ← fetchGoogleTrends() e fetchYouTubeShorts()
  supabase/
types/index.ts
```

## Regras de desenvolvimento

- **Dark minimal**: fundo `#0a0a0a`, texto `#e5e5e5`, bordas `#1a1a1a`. Sem gradientes, sombras ou linguagem motivacional.
- Não criar arquivos desnecessários. Preferir editar o existente.
- Não adicionar tratamento de erro para cenários impossíveis.
- Não criar abstrações para uso único.
- Antes de qualquer rota API do Next.js 16, ler o doc correspondente em `node_modules/next/dist/docs/`.

## Dois perfis editoriais

- **RUAN**: motor de crescimento. Volume, leveza, gancho no primeiro segundo.
- **OVERLENS**: autoridade. Gancho nos 5 primeiros segundos, entrega algo concreto.

## Banco de dados

Tabela `sessions`: `id (uuid)`, `user_id`, `type ('transcription'|'trends'|'full')`, `input (text)`, `result (jsonb)`, `created_at`.
RLS ativo: cada usuário vê apenas suas próprias sessões.
