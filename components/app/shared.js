import { useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createDefaultFinanceData, normalizeFinanceData } from "../../lib/finance";

export const TARGET = 1_000_000;
export const G = "#f5c970";
export const GL = "#ffe39e";
export const BG = "#07090f";
export const S1 = "#101423";
export const S2 = "#171d31";
export const S3 = "#222a43";
export const BD = "rgba(180,196,255,0.12)";
export const BD2 = "rgba(210,223,255,0.22)";
export const T = "#f8faff";
export const T2 = "#b0bddf";
export const T3 = "#7a86a8";
export const GR = "#39d08f";
export const RD = "#ff6d7f";
export const BL = "#67b4ff";
export const PU = "#b38cff";
export const APP_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Outfit', sans-serif";

export const MILESTONES = [
  { amount: 10_000, label: "Primeiro Marco" },
  { amount: 25_000, label: "25K" },
  { amount: 50_000, label: "50K" },
  { amount: 100_000, label: "100K" },
  { amount: 250_000, label: "Um Quarto" },
  { amount: 500_000, label: "Meio Caminho" },
  { amount: 750_000, label: "Três Quartos" },
  { amount: 1_000_000, label: "O Milhão!" },
];

export const PORTFOLIO_TYPES = [
  { key: "bank", label: "Banco", color: BL },
  { key: "broker", label: "Corretora / Broker", color: GR },
  { key: "crypto", label: "Exchange Cripto", color: PU },
  { key: "savings", label: "Poupança", color: G },
  { key: "pension", label: "Pensão / 3º Pilar", color: "#e08855" },
  { key: "other", label: "Outro", color: T2 },
];

export const ASSET_TYPES = [
  { key: "fiat", label: "Dinheiro / Fiat", hasTicker: false, color: BL },
  { key: "etf", label: "ETF", hasTicker: true, color: G },
  { key: "stock", label: "Ação", hasTicker: true, color: GR },
  { key: "crypto", label: "Cripto", hasTicker: true, color: PU },
  { key: "bond", label: "Obrigação", hasTicker: true, color: T2 },
  { key: "other", label: "Outro", hasTicker: false, color: T3 },
];

export const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "BTC", "ETH"];
export const PALETTE = ["#f5c970", "#67b4ff", "#39d08f", "#b38cff", "#ff9f68", "#5fd2e6", "#ff6d9c"];

export const IDEA_STATUSES = [
  { key: "idea", label: "Ideia", color: BL },
  { key: "testing", label: "A Testar", color: G },
  { key: "active", label: "Ativo", color: GR },
  { key: "paused", label: "Pausado", color: T2 },
  { key: "abandoned", label: "Abandonado", color: RD },
];

export const IDEA_CATS = ["Digital", "Freelance", "Investimento", "Negócio", "Imobiliário", "Outro"];

export const ETF_PICKS = [
  { sym: "SXR8.DE", name: "iShares S&P 500 (EUR)", cur: "EUR" },
  { sym: "VWCE.DE", name: "Vanguard FTSE All-World", cur: "EUR" },
  { sym: "EUNL.DE", name: "iShares Core MSCI World", cur: "EUR" },
  { sym: "CSPX.L", name: "iShares S&P 500 (USD)", cur: "USD" },
  { sym: "IWDA.AS", name: "iShares MSCI World", cur: "USD" },
  { sym: "CSNDX.SW", name: "iShares Nasdaq 100 (CHF)", cur: "CHF" },
  { sym: "VUSA.L", name: "Vanguard S&P 500 (GBP)", cur: "GBP" },
  { sym: "IEMA.L", name: "iShares MSCI Emerg Mkt", cur: "USD" },
];

export function lsGet(k) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

export const fmtN = (n) => {
  if (n == null || Number.isNaN(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1000) return (n / 1000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("de-CH");
};

export const fmtF = (n) =>
  n == null ? "–" : (+n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtD = (iso) =>
  !iso ? "–" : new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });

export const fmtDs = (iso) =>
  !iso ? "" : new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

export async function apiSearch(q) {
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(q));
    const d = await r.json();
    return d.results || [];
  } catch {
    return [];
  }
}

export async function apiBatchQuotes(symbols) {
  if (!symbols.length) return {};
  try {
    const r = await fetch("/api/quote?symbols=" + symbols.map(encodeURIComponent).join(","));
    const d = await r.json();
    return d.quotes || {};
  } catch {
    return {};
  }
}

export async function apiSingleQuote(symbol) {
  const batch = await apiBatchQuotes([symbol]);
  return batch[symbol.toUpperCase()] || batch[symbol] || null;
}

export async function apiFxRates() {
  try {
    const r = await fetch("/api/fx");
    const d = await r.json();
    return d.rates || { EUR: 0.94, USD: 0.89, GBP: 1.13 };
  } catch {
    return { EUR: 0.94, USD: 0.89, GBP: 1.13 };
  }
}

export async function apiGetUserData() {
  const response = await fetch("/api/user-data");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro ao carregar dados do utilizador.");
  }
  return data.data;
}

export async function apiSaveUserData(payload) {
  const response = await fetch("/api/user-data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro ao guardar dados do utilizador.");
  }
  return data.data;
}

export async function apiAuthRequest(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro de autenticação.");
  }

  return data;
}

export async function apiGoalSuggestions(goal) {
  const response = await fetch("/api/goal-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível gerar sugestões");
  }

  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

export function readLocalAppData() {
  return {
    portfolios: lsGet("portfolios") || [],
    nwHistory: lsGet("nw_snapshots") || [],
    ideas: lsGet("income_ideas") || [],
    goals: lsGet("goals") || [],
    startDate: lsGet("start_date"),
    baseCurrency: lsGet("base_currency") || "CHF",
    calendarSlots: lsGet("calendar_slots") || [],
    financeData: normalizeFinanceData(lsGet("finance_data") || lsGet("monthly_finances") || createDefaultFinanceData()),
  };
}

export function hasMeaningfulAppData(data) {
  return Boolean(
    data?.portfolios?.length ||
      data?.nwHistory?.length ||
      data?.ideas?.length ||
      data?.goals?.length ||
      data?.calendarSlots?.length ||
      data?.financeData?.transactions?.length ||
      data?.startDate,
  );
}

export function isEmptyRemoteData(data) {
  return !hasMeaningfulAppData(data) && (data?.baseCurrency || "CHF") === "CHF";
}

export function toChf(value, currency, fx) {
  if (currency === "CHF") return value;
  return fx[currency] ? value * fx[currency] : null;
}

export function toBaseCurrency(valueInChf, baseCurrency, fx) {
  if (baseCurrency === "CHF") return valueInChf;
  return fx[baseCurrency] ? valueInChf / fx[baseCurrency] : valueInChf;
}

export function assetValChf(asset, prices, fx) {
  if (asset.type === "fiat") return toChf(asset.quantity, asset.currency, fx) ?? asset.quantity;
  if (!asset.ticker) return null;
  const p = prices[asset.ticker.toUpperCase()];
  if (!p) return null;
  return toChf(asset.quantity * p.price, asset.currency, fx) ?? null;
}

export function assetCostChf(asset, fx) {
  if (!asset.buyPrice) return 0;
  return toChf(asset.quantity * asset.buyPrice, asset.currency, fx) ?? 0;
}

export function pfValChf(pf, prices, fx) {
  return pf.assets.reduce((s, a) => s + (assetValChf(a, prices, fx) ?? 0), 0);
}

export function totalNW(portfolios, prices, fx) {
  return portfolios.reduce((s, p) => s + pfValChf(p, prices, fx), 0);
}

export function inferType(quoteType, symbol, name) {
  const qt = (quoteType || "").toUpperCase();
  const s = (symbol || "").toUpperCase();
  const n = (name || "").toUpperCase();
  if (qt === "CRYPTOCURRENCY" || s.includes("BTC") || s.includes("ETH") || s.endsWith("-USD")) return "crypto";
  if (qt === "ETF" || n.includes("ETF") || n.includes("UCITS") || n.includes("ISHARES") || n.includes("VANGUARD")) return "etf";
  if (qt === "BOND" || n.includes("BOND")) return "bond";
  return "stock";
}

export function guessCurrency(symbol) {
  const s = (symbol || "").toUpperCase();
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".DE") || s.endsWith(".PA") || s.endsWith(".AS") || s.endsWith(".MI")) return "EUR";
  if (s.endsWith(".L")) return "GBP";
  return "USD";
}

export const card = (x = {}) => ({
  background: "linear-gradient(165deg, rgba(255,255,255,.035), rgba(255,255,255,.01))",
  border: "1px solid " + BD,
  borderRadius: 18,
  padding: "20px 22px",
  boxShadow: "0 14px 36px rgba(4,8,20,.42)",
  backdropFilter: "blur(12px)",
  ...x,
});

export const btn = (x = {}) => ({
  padding: "10px 20px",
  borderRadius: 12,
  border: "1px solid " + BD2,
  background: "rgba(255,255,255,.03)",
  color: T,
  fontFamily: APP_FONT,
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 500,
  transition: "all .18s ease",
  ...x,
});

export const btnG = {
  ...btn(),
  background: "linear-gradient(135deg, #f5c970 0%, #f0b44e 100%)",
  border: "1px solid " + GL,
  color: "#1d1407",
  boxShadow: "0 10px 24px rgba(245,201,112,.25)",
};

export const bsm = (x = {}) => btn({ padding: "6px 12px", fontSize: 12, ...x });

export const inp = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid " + BD2,
  borderRadius: 12,
  padding: "11px 14px",
  color: T,
  fontFamily: APP_FONT,
  fontSize: 14,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

export const lbl = {
  fontSize: 12,
  color: T2,
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

export function Stars({ value, onChange, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          onClick={() => onChange?.(i + 1)}
          style={{
            fontSize: 20,
            cursor: onChange ? "pointer" : "default",
            color: i < value ? G : T3,
            lineHeight: 1,
            userSelect: "none",
          }}>
          ★
        </span>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color = G, height = 8 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ background: S3, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: height, transition: "width .6s ease" }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S1, border: "1px solid " + BD2, borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: wide ? 580 : 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T }}>{title}</span>
          <button onClick={onClose} style={bsm()}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NwChart({ data, baseCurrency }) {
  if (!data || data.length === 0)
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: T3, fontSize: 13 }}>Actualiza os preços para ver a evolução do patrimônio.</p>
      </div>
    );

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: S2, border: "1px solid " + BD2, borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ fontSize: 11, color: T2, marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 15, color: G, fontWeight: 600 }}>
          {baseCurrency} {fmtF(payload[0].value)}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={G} stopOpacity={0.22} />
            <stop offset="95%" stopColor={G} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} width={42} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="value" stroke={G} strokeWidth={2} fill="url(#gGrad)" dot={false} activeDot={{ r: 4, fill: G, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
