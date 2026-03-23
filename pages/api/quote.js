import { requireAuth } from "../../lib/auth";

function parseStooqCsv(csv) {
  // stooq returns a simple CSV with a header row.
  // Example: Symbol,Date,Time,Open,High,Low,Close,Volume
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return {};

  const headers = lines[0].split(",");
  const results = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row.length !== headers.length) continue;
    const record = Object.fromEntries(headers.map((h, idx) => [h, row[idx]]));
    const symbol = (record.Symbol || "").toUpperCase();
    const close = parseFloat((record.Close || "").replace(/[^0-9.\-]/g, ""));
    if (!symbol || !close || Number.isNaN(close)) continue;

    const open = parseFloat((record.Open || "").replace(/[^0-9.\-]/g, ""));
    const change = open && !Number.isNaN(open) ? close - open : 0;
    const changePct = open && !Number.isNaN(open) && open !== 0 ? (change / open) * 100 : 0;

    results[symbol.replace(/\.US$/i, "")] = {
      price: close,
      change,
      changePct,
      currency: "USD",
      name: symbol,
    };
  }

  return results;
}

async function queryYahooChart(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    return {
      price: meta.regularMarketPrice,
      change: meta.regularMarketChange ?? 0,
      changePct: meta.regularMarketChangePercent ?? 0,
      currency: meta.currency ?? "USD",
      name: meta.symbol || symbol,
    };
  } catch (e) {
    return null;
  }
}

async function queryStooq(symbols) {
  const results = {};
  if (!symbols.length) return results;

  // Stooq CSV doesn't support multiple symbols in one request properly.
  // It returns them in a single row, which breaks parsing.
  // So we query one by one for reliability.
  for (const symbol of symbols) {
    const upper = symbol.toUpperCase();
    const isMaybeUS = /^[A-Z]{1,5}$/.test(upper);
    const normalized = isMaybeUS ? `${upper}.US` : upper;

    const url = `https://stooq.com/q/l/?s=${normalized.toLowerCase()}&f=sd2t2ohlcv&h&e=csv`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const text = await resp.text();
      const parsed = parseStooqCsv(text);
      Object.assign(results, parsed);
    } catch (e) {
      // Skip this symbol if fetch fails
    }
  }

  return results;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: "symbols required", quotes: {} });

  const list = symbols
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  if (list.length === 0) return res.status(200).json({ quotes: {} });

  try {
    const quotes = {};
    for (const symbol of list) {
      const yahooData = await queryYahooChart(symbol);
      if (yahooData) {
        quotes[symbol] = yahooData;
      }
    }

    if (Object.keys(quotes).length < list.length) {
      const stooqQuotes = await queryStooq(list);
      for (const symbol of list) {
        if (!quotes[symbol] && stooqQuotes[symbol]) {
          quotes[symbol] = stooqQuotes[symbol];
        }
      }
    }

    res.status(200).json({ quotes });
  } catch (err) {
    console.error("[quote] error:", err?.message ?? err);

    // Try fallback so the app still works even if Yahoo blocks us.
    let quotes = await queryStooq(list);

    // If Stooq didn't have data for some symbols, try Yahoo chart endpoint (public).
    for (const symbol of list) {
      if (!quotes[symbol]) {
        const yahooData = await queryYahooChart(symbol);
        if (yahooData) {
          quotes[symbol] = yahooData;
        }
      }
    }

    res.status(200).json({ quotes, error: err?.message ?? String(err) });
  }
}
