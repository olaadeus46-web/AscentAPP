import { requireAuth } from "../../lib/auth";

export default async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Query too short", results: [] });
  }

  try {
    const query = q.trim();
    const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", query);
    url.searchParams.set("quotesCount", "10");
    url.searchParams.set("newsCount", "0");
    url.searchParams.set("enableFuzzyQuery", "false");

    const response = await fetch(url.toString());
    const data = await response.json();

    const results = (data.quotes || [])
      .filter(
        (item) =>
          item.symbol &&
          item.isYahooFinance &&
          item.quoteType !== "OPTION" &&
          item.quoteType !== "FUTURE"
      )
      .slice(0, 9)
      .map((item) => ({
        symbol:    item.symbol,
        name:      item.shortname || item.longname || item.symbol,
        exchange:  item.exchDisp  || item.exchange || "",
        type:      item.quoteType || "EQUITY",
        currency:  item.currency  || "",
      }));

    res.status(200).json({ results });
  } catch (err) {
    console.error("[search] error:", err?.message ?? err);
    res.status(200).json({ results: [], error: err?.message ?? String(err) });
  }
}
