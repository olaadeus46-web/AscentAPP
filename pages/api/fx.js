import yahooFinance from "yahoo-finance2";
import { requireAuth } from "../../lib/auth";

const yf = new yahooFinance();

const FX_PAIRS = ["EURCHF=X", "USDCHF=X", "GBPCHF=X"];
const CURRENCY_MAP = { "EURCHF=X": "EUR", "USDCHF=X": "USD", "GBPCHF=X": "GBP" };

async function queryStooqFx(pairs) {
  const rates = {};

  // Stooq's multi-symbol CSV output is not consistent for FX, so query one at a time.
  for (const pair of pairs) {
    const sym = pair.replace("=X", "").toLowerCase();
    const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
    const resp = await fetch(url);
    if (!resp.ok) continue;
    const text = await resp.text();

    const lines = text.trim().split("\n");
    if (lines.length < 2) continue;

    const row = lines[1].split(",");
    const close = parseFloat((row[6] || "").replace(/[^0-9.\-]/g, ""));
    if (!close || Number.isNaN(close)) continue;

    rates[pair] = close;
  }

  return rates;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const raw = await yf.quote(FX_PAIRS, { fields: ["regularMarketPrice"] });
    const items = Array.isArray(raw) ? raw : [raw];

    const rates = { EUR: 0.94, USD: 0.89, GBP: 1.13 }; // fallbacks
    for (const item of items) {
      const cur = CURRENCY_MAP[item.symbol];
      if (cur && item.regularMarketPrice > 0) {
        rates[cur] = item.regularMarketPrice;
      }
    }

    // If Yahoo didn't return anything useful, fall back to Stooq.
    if (rates.EUR === 0.94 && rates.USD === 0.89 && rates.GBP === 1.13) {
      const stooqRates = await queryStooqFx(FX_PAIRS);
      for (const [symbol, rate] of Object.entries(stooqRates)) {
        const cur = CURRENCY_MAP[symbol];
        if (cur && rate > 0) {
          rates[cur] = rate;
        }
      }
    }

    res.status(200).json({ rates });
  } catch (err) {
    console.error("[fx] error:", err?.message ?? err);

    // Try Stooq fallback so the app still works even if Yahoo is blocked.
    const rates = { EUR: 0.94, USD: 0.89, GBP: 1.13 };
    const stooqRates = await queryStooqFx(FX_PAIRS);
    for (const [symbol, rate] of Object.entries(stooqRates)) {
      const cur = CURRENCY_MAP[symbol];
      if (cur && rate > 0) {
        rates[cur] = rate;
      }
    }

    res.status(200).json({ rates });
  }
}

