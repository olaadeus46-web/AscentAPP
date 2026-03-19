# Rota ao Milhão 🪙

App pessoal de tracking de patrimônio com preços em tempo real via Yahoo Finance.

## Base de dados Supabase e autenticação

- A app usa Supabase Data API (Postgres)
- O sistema de autenticação usa sessão por cookie `httpOnly`
- Patrimônio, Ideias, Objetivos, Calendário, snapshots e moeda base ficam guardados por utilizador na tabela `user_data`
- Em desenvolvimento, se `AUTH_SECRET` não estiver definido, é usado um segredo local de fallback

Cria um ficheiro `.env.local`:

```bash
AUTH_SECRET=troca-isto-por-um-segredo-longo
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
# recomendado para produção (server-side, mais seguro)
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_xxx
ANTHROPIC_API_KEY=...
NEWSAPI_KEY=...
```

Depois, executa o SQL em `data/supabase-schema.sql` no SQL Editor do Supabase.

A primeira conta é criada no ecrã inicial da app. Depois disso, o acesso passa a exigir login.

## Instalação e arranque

```bash
# 1. Instalar dependências
npm install

# 2. Arrancar em modo desenvolvimento
npm run dev
```

Abre o browser em **http://localhost:3000**

## Como funciona

- A app corre localmente no teu computador
- O backend (Next.js API routes) faz as chamadas à Yahoo Finance sem problemas de CORS
- A autenticação e dados de utilizador são guardados no Supabase
- Suporta ETFs europeus: SXR8.DE, VWCE.DE, CSPX.L, NOVN.SW, etc.

## Tickers suportados

| Tipo | Exemplos |
|------|---------|
| ETF Xetra (EUR) | SXR8.DE, VWCE.DE, EUNL.DE |
| ETF LSE (USD/GBP) | CSPX.L, IWDA.AS, VUSA.L |
| ETF SIX (CHF) | CSNDX.SW |
| Ações US | AAPL, MSFT, NVDA, GOOGL |
| Ações EU | NOVN.SW, NESN.SW, ASML.AS |
| Cripto | BTC-USD, ETH-USD |
| Forex | EURCHF=X (automático) |

## Deploy na Vercel (opcional, gratuito)

```bash
npm install -g vercel
vercel
```

Segue as instruções — a app fica online em 2 minutos.

## Deploy na Netlify (variáveis obrigatórias)

No painel da Netlify (Site settings > Environment variables), define:

- `AUTH_SECRET` (ou `JWT_SECRET`) com um valor longo e aleatório
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`)
- `ANTHROPIC_API_KEY` (se usares chat/sugestões)
- `NEWSAPI_KEY` (se usares notícias)

Se faltar `AUTH_SECRET` em produção, o login/session vai falhar com erro de autenticação.
