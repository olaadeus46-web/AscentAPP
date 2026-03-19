# Rota ao Milhão 🪙

App pessoal de tracking de patrimônio com preços em tempo real via Yahoo Finance.

## Base de dados local e autenticação

- A app usa agora SQLite local em `data/app.db`
- O sistema de autenticação usa sessão por cookie `httpOnly`
- Patrimônio, Ideias, Objetivos, Calendário, snapshots e moeda base ficam guardados por utilizador
- Em desenvolvimento, se `AUTH_SECRET` não estiver definido, é usado um segredo local de fallback

Se quiseres definir explicitamente o segredo, cria um ficheiro `.env.local`:

```bash
AUTH_SECRET=troca-isto-por-um-segredo-longo
ANTHROPIC_API_KEY=...
NEWSAPI_KEY=...
```

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
- A autenticação é guardada em SQLite local e a sessão fica em cookie seguro
- Os dados financeiros continuam a ser guardados no localStorage do browser
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
