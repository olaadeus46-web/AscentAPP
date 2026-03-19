import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Head from "next/head";
import ReactMarkdown from 'react-markdown';
import CalendarView from "../components/CalendarView";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const TARGET = 1_000_000;
const G  = "#c9a84c";
const GL = "#e8c96a";
const BG = "#0d0d10";
const S1 = "#141418";
const S2 = "#1c1c22";
const S3 = "#26262e";
const BD  = "rgba(255,255,255,0.07)";
const BD2 = "rgba(255,255,255,0.13)";
const T   = "#eeeeea";
const T2  = "#88888f";
const T3  = "#555560";
const GR  = "#4db87a";
const RD  = "#e05555";
const BL  = "#5599dd";
const PU  = "#aa77dd";

const MILESTONES = [
  { amount: 10_000,   label: "Primeiro Marco" },
  { amount: 25_000,   label: "25K" },
  { amount: 50_000,   label: "50K" },
  { amount: 100_000,  label: "100K" },
  { amount: 250_000,  label: "Um Quarto" },
  { amount: 500_000,  label: "Meio Caminho" },
  { amount: 750_000,  label: "Três Quartos" },
  { amount: 1_000_000, label: "O Milhão!" },
];

const PORTFOLIO_TYPES = [
  { key: "bank",    label: "Banco",              color: BL },
  { key: "broker",  label: "Corretora / Broker", color: GR },
  { key: "crypto",  label: "Exchange Cripto",    color: PU },
  { key: "savings", label: "Poupança",           color: G  },
  { key: "pension", label: "Pensão / 3º Pilar",  color: "#e08855" },
  { key: "other",   label: "Outro",              color: T2 },
];

const ASSET_TYPES = [
  { key: "fiat",   label: "Dinheiro / Fiat", hasTicker: false, color: BL },
  { key: "etf",    label: "ETF",             hasTicker: true,  color: G  },
  { key: "stock",  label: "Ação",            hasTicker: true,  color: GR },
  { key: "crypto", label: "Cripto",          hasTicker: true,  color: PU },
  { key: "bond",   label: "Obrigação",       hasTicker: true,  color: T2 },
  { key: "other",  label: "Outro",           hasTicker: false, color: T3 },
];

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "BTC", "ETH"];
const PALETTE    = ["#c9a84c","#5599dd","#4db87a","#aa77dd","#e08855","#55bbdd","#dd5577"];

const IDEA_STATUSES = [
  { key: "idea",      label: "Ideia",      color: BL },
  { key: "testing",   label: "A Testar",   color: G  },
  { key: "active",    label: "Ativo",      color: GR },
  { key: "paused",    label: "Pausado",    color: T2 },
  { key: "abandoned", label: "Abandonado", color: RD },
];
const IDEA_CATS = ["Digital","Freelance","Investimento","Negócio","Imobiliário","Outro"];

const ETF_PICKS = [
  { sym: "SXR8.DE",  name: "iShares S&P 500 (EUR)",   cur: "EUR" },
  { sym: "VWCE.DE",  name: "Vanguard FTSE All-World",  cur: "EUR" },
  { sym: "EUNL.DE",  name: "iShares Core MSCI World",  cur: "EUR" },
  { sym: "CSPX.L",   name: "iShares S&P 500 (USD)",    cur: "USD" },
  { sym: "IWDA.AS",  name: "iShares MSCI World",        cur: "USD" },
  { sym: "CSNDX.SW", name: "iShares Nasdaq 100 (CHF)", cur: "CHF" },
  { sym: "VUSA.L",   name: "Vanguard S&P 500 (GBP)",   cur: "GBP" },
  { sym: "IEMA.L",   name: "iShares MSCI Emerg Mkt",   cur: "USD" },
];

// ─── LOCAL STORAGE ───────────────────────────────────────────────────────────
function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

// ─── FORMAT ──────────────────────────────────────────────────────────────────
const fmtN  = n => { if (n == null || isNaN(n)) return "–"; const a = Math.abs(n); if (a >= 1e6) return (n/1e6).toFixed(2)+"M"; if (a >= 1000) return (n/1000).toFixed(1)+"K"; return Math.round(n).toLocaleString("de-CH"); };
const fmtF  = n => n == null ? "–" : (+n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD  = iso => !iso ? "–" : new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
const fmtDs = iso => !iso ? "" : new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

// ─── API CALLS (to our Next.js backend) ──────────────────────────────────────
async function apiSearch(q) {
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(q));
    const d = await r.json();
    return d.results || [];
  } catch { return []; }
}

async function apiBatchQuotes(symbols) {
  if (!symbols.length) return {};
  try {
    const r = await fetch("/api/quote?symbols=" + symbols.map(encodeURIComponent).join(","));
    const d = await r.json();
    return d.quotes || {};
  } catch { return {}; }
}

async function apiSingleQuote(symbol) {
  const batch = await apiBatchQuotes([symbol]);
  return batch[symbol.toUpperCase()] || batch[symbol] || null;
}

async function apiFxRates() {
  try {
    const r = await fetch("/api/fx");
    const d = await r.json();
    return d.rates || { EUR: 0.94, USD: 0.89, GBP: 1.13 };
  } catch { return { EUR: 0.94, USD: 0.89, GBP: 1.13 }; }
}

async function apiGetUserData() {
  const response = await fetch("/api/user-data");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro ao carregar dados do utilizador.");
  }
  return data.data;
}

async function apiSaveUserData(payload) {
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

async function apiAuthRequest(path, payload) {
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

async function apiGoalSuggestions(goal) {
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

function readLocalAppData() {
  return {
    portfolios: lsGet("portfolios") || [],
    nwHistory: lsGet("nw_snapshots") || [],
    ideas: lsGet("income_ideas") || [],
    goals: lsGet("goals") || [],
    startDate: lsGet("start_date"),
    baseCurrency: lsGet("base_currency") || "CHF",
    calendarSlots: lsGet("calendar_slots") || [],
  };
}

function hasMeaningfulAppData(data) {
  return Boolean(
    data?.portfolios?.length ||
    data?.nwHistory?.length ||
    data?.ideas?.length ||
    data?.goals?.length ||
    data?.calendarSlots?.length ||
    data?.startDate
  );
}

function isEmptyRemoteData(data) {
  return !hasMeaningfulAppData(data) && (data?.baseCurrency || "CHF") === "CHF";
}

// ─── CALCULATIONS ────────────────────────────────────────────────────────────
function toChf(value, currency, fx) {
  if (currency === "CHF") return value;
  return fx[currency] ? value * fx[currency] : null;
}
function toBaseCurrency(valueInChf, baseCurrency, fx) {
  if (baseCurrency === "CHF") return valueInChf;
  return fx[baseCurrency] ? valueInChf / fx[baseCurrency] : valueInChf;
}
function assetValChf(asset, prices, fx) {
  if (asset.type === "fiat") return toChf(asset.quantity, asset.currency, fx) ?? asset.quantity;
  if (!asset.ticker) return null;
  const p = prices[asset.ticker.toUpperCase()];
  if (!p) return null;
  return toChf(asset.quantity * p.price, asset.currency, fx) ?? null;
}
function assetCostChf(asset, fx) {
  if (!asset.buyPrice) return 0;
  return toChf(asset.quantity * asset.buyPrice, asset.currency, fx) ?? 0;
}
function pfValChf(pf, prices, fx) { return pf.assets.reduce((s, a) => s + (assetValChf(a, prices, fx) ?? 0), 0); }
function totalNW(portfolios, prices, fx) { return portfolios.reduce((s, p) => s + pfValChf(p, prices, fx), 0); }

function inferType(quoteType, symbol, name) {
  const qt = (quoteType || "").toUpperCase();
  const s  = (symbol || "").toUpperCase();
  const n  = (name || "").toUpperCase();
  if (qt === "CRYPTOCURRENCY" || s.includes("BTC") || s.includes("ETH") || s.endsWith("-USD")) return "crypto";
  if (qt === "ETF" || n.includes("ETF") || n.includes("UCITS") || n.includes("ISHARES") || n.includes("VANGUARD")) return "etf";
  if (qt === "BOND" || n.includes("BOND")) return "bond";
  return "stock";
}

function guessCurrency(symbol) {
  const s = (symbol || "").toUpperCase();
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".DE") || s.endsWith(".PA") || s.endsWith(".AS") || s.endsWith(".MI")) return "EUR";
  if (s.endsWith(".L")) return "GBP";
  return "USD";
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const card = (x = {}) => ({ background: S1, border: "1px solid "+BD, borderRadius: 12, padding: "20px 22px", ...x });
const btn  = (x = {}) => ({ padding: "10px 20px", borderRadius: 8, border: "1px solid "+BD2, background: "transparent", color: T, fontFamily: "'Outfit',sans-serif", fontSize: 14, cursor: "pointer", fontWeight: 500, transition: "all .15s", ...x });
const btnG = { ...btn(), background: G, border: "1px solid "+GL, color: "#1a1205" };
const bsm  = (x = {}) => btn({ padding: "6px 12px", fontSize: 12, ...x });
const inp  = { background: S2, border: "1px solid "+BD2, borderRadius: 8, padding: "10px 14px", color: T, fontFamily: "'Outfit',sans-serif", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
const lbl  = { fontSize: 12, color: T2, fontWeight: 500, marginBottom: 6, display: "block" };

// ─── SHARED UI ───────────────────────────────────────────────────────────────
function Stars({ value, onChange, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} onClick={() => onChange?.(i + 1)}
          style={{ fontSize: 20, cursor: onChange ? "pointer" : "default", color: i < value ? G : T3, lineHeight: 1, userSelect: "none" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = G, height = 8 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ background: S3, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: height, transition: "width .6s ease" }} />
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S1, border: "1px solid "+BD2, borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: wide ? 580 : 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T }}>{title}</span>
          <button onClick={onClose} style={bsm()}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── CHART ───────────────────────────────────────────────────────────────────
function NwChart({ data, baseCurrency }) {
  if (!data || data.length === 0) return (
    <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T3, fontSize: 13 }}>Actualiza os preços para ver a evolução do patrimônio.</p>
    </div>
  );
  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: S2, border: "1px solid "+BD2, borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ fontSize: 11, color: T2, marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 15, color: G, fontWeight: 600 }}>{baseCurrency} {fmtF(payload[0].value)}</p>
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={G} stopOpacity={0.22} />
            <stop offset="95%" stopColor={G} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} tickFormatter={v => (v/1000).toFixed(0)+"K"} width={42} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="value" stroke={G} strokeWidth={2} fill="url(#gGrad)" dot={false} activeDot={{ r: 4, fill: G, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── ADD ASSET MODAL ─────────────────────────────────────────────────────────
function AddAssetModal({ onClose, onSave }) {
  const TABS = ["Pesquisar", "Ticker Manual", "Fiat / Dinheiro"];
  const [tab,        setTab]        = useState(0);
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [noRes,      setNoRes]      = useState(false);
  const [manTicker,  setManTicker]  = useState("");
  const [validating, setValidating] = useState(false);
  const [valErr,     setValErr]     = useState("");
  const [step,       setStep]       = useState("pick");
  const [livePrice,  setLivePrice]  = useState(null);
  const [form, setForm] = useState({
    name: "", ticker: "", type: "etf", currency: "EUR",
    quantity: "", buyPrice: "", buyDate: new Date().toISOString().slice(0, 10), notes: "",
  });
  const timer = useRef(null);
  const qRef  = useRef(null);
  const mRef  = useRef(null);

  useEffect(() => {
    if (tab === 0) setTimeout(() => qRef.current?.focus(), 80);
    if (tab === 1) setTimeout(() => mRef.current?.focus(), 80);
    if (tab === 2) goToForm({ name: "", ticker: "", type: "fiat", currency: "CHF" });
    // eslint-disable-next-line
  }, [tab]);

  useEffect(() => {
    clearTimeout(timer.current);
    setNoRes(false); setResults([]);
    if (query.length < 2) return;
    timer.current = setTimeout(async () => {
      setSearching(true);
      const res = await apiSearch(query);
      setResults(res);
      setNoRes(res.length === 0);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [query]);

  const goToForm = async (preset) => {
    setForm(f => ({ ...f, ...preset }));
    setStep("form");
    if (preset.ticker) {
      setValidating(true);
      const q = await apiSingleQuote(preset.ticker);
      if (q) {
        setLivePrice(q);
        setForm(f => ({ ...f, currency: q.currency || f.currency, name: f.name || q.name || preset.ticker }));
      }
      setValidating(false);
    }
  };

  const pickResult = (res) => {
    const type = inferType(res.type, res.symbol, res.name);
    const cur  = res.currency || guessCurrency(res.symbol);
    goToForm({ ticker: res.symbol, name: res.name, type, currency: cur });
    setQuery(""); setResults([]);
  };

  const validateManual = async () => {
    const t = manTicker.trim().toUpperCase();
    if (!t) return;
    setValidating(true); setValErr("");
    const q = await apiSingleQuote(t);
    if (!q) {
      setValErr(`"${t}" não encontrado. Verifica o ticker — ex: SXR8.DE, VWCE.DE, AAPL, BTC-USD`);
      setValidating(false); return;
    }
    setLivePrice(q);
    setForm(f => ({ ...f, ticker: t, name: q.name || t, type: inferType("", t, ""), currency: q.currency || guessCurrency(t) }));
    setStep("form");
    setValidating(false);
  };

  const save = () => {
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return;
    if (form.type === "fiat" && !form.name.trim()) return;
    onSave({ ...form, id: Date.now(), quantity: qty, buyPrice: parseFloat(form.buyPrice) || 0, ticker: form.type === "fiat" ? null : form.ticker });
  };

  const isFiat    = form.type === "fiat";
  const typeColor = ASSET_TYPES.find(a => a.key === form.type)?.color || T2;
  const typeLabel = ASSET_TYPES.find(a => a.key === form.type)?.label || "";
  const canSave   = parseFloat(form.quantity) > 0 && (isFiat ? form.name.trim() : form.ticker);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S1, border: "1px solid "+BD2, borderRadius: 18, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header + tabs */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid "+BD }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T }}>Adicionar Ativo</span>
            <button onClick={onClose} style={bsm()}>×</button>
          </div>
          {step === "pick" && (
            <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
              {TABS.map((label, i) => (
                <button key={i} onClick={() => setTab(i)} style={{
                  ...bsm({ fontSize: 13, padding: "9px 16px", marginRight: 2, fontWeight: tab === i ? 600 : 400 }),
                  borderRadius: "8px 8px 0 0",
                  border: "1px solid " + (tab === i ? BD2 : BD),
                  borderBottom: "1px solid " + (tab === i ? S1 : BD),
                  background: tab === i ? S1 : S2,
                  color: tab === i ? T : T2,
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* TAB: PESQUISAR */}
          {step === "pick" && tab === 0 && (
            <>
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T3, fontSize: 16, pointerEvents: "none" }}>
                    {searching ? "⟳" : "⌕"}
                  </span>
                  <input ref={qRef} style={{ ...inp, paddingLeft: 34, fontSize: 14 }}
                    placeholder="Pesquisar: SXR8, Vanguard, Apple, Bitcoin..."
                    value={query} onChange={e => setQuery(e.target.value)}
                  />
                </div>

                {(results.length > 0 || noRes) && (
                  <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, background: S2, border: "1px solid "+BD2, borderRadius: 10, zIndex: 40, overflow: "hidden", boxShadow: "0 10px 36px rgba(0,0,0,.55)" }}>
                    {noRes && (
                      <div style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 13, color: T2, marginBottom: 6 }}>Sem resultados para "{query}"</p>
                        <p style={{ fontSize: 12, color: T3 }}>
                          Tenta o{" "}
                          <span style={{ color: G, cursor: "pointer", fontWeight: 600 }}
                            onClick={() => { setTab(1); setManTicker(query.toUpperCase()); }}>
                            Ticker Manual
                          </span>
                          {" "}com o símbolo exacto (ex: SXR8.DE)
                        </p>
                      </div>
                    )}
                    {results.map((res, i) => {
                      const it = inferType(res.type, res.symbol, res.name);
                      const ic = ASSET_TYPES.find(a => a.key === it)?.color || T2;
                      return (
                        <div key={i} onClick={() => pickResult(res)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid "+BD : "none", transition: "background .1s" }}
                          onMouseEnter={e => e.currentTarget.style.background = S3}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T, fontFamily: "monospace" }}>{res.symbol}</span>
                              <span style={{ fontSize: 10, color: ic, background: ic+"18", padding: "2px 7px", borderRadius: 20, fontWeight: 600 }}>
                                {ASSET_TYPES.find(a => a.key === it)?.label}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{res.name}</p>
                          </div>
                          <span style={{ fontSize: 11, color: T3, flexShrink: 0 }}>{res.exchange}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!query && (
                <div>
                  <p style={{ fontSize: 11, color: T3, marginBottom: 10, letterSpacing: .5, textTransform: "uppercase" }}>ETFs europeus populares</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ETF_PICKS.map(item => (
                      <button key={item.sym}
                        onClick={() => goToForm({ ticker: item.sym, name: item.name, type: "etf", currency: item.cur })}
                        style={{ ...bsm({ fontSize: 12, padding: "7px 13px", color: G, borderColor: G+"30" }) }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{item.sym}</span>
                        <span style={{ color: T3, marginLeft: 6, fontSize: 11 }}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB: TICKER MANUAL */}
          {step === "pick" && tab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={lbl}>Ticker Yahoo Finance *</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={mRef}
                    style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: 15, letterSpacing: .5, borderColor: valErr ? RD : BD2 }}
                    placeholder="SXR8.DE   VWCE.DE   AAPL   NOVN.SW   BTC-USD"
                    value={manTicker}
                    onChange={e => { setManTicker(e.target.value.toUpperCase()); setValErr(""); }}
                    onKeyDown={e => e.key === "Enter" && validateManual()}
                  />
                  <button onClick={validateManual} disabled={validating || !manTicker.trim()}
                    style={{ ...bsm({ padding: "10px 18px", color: G, borderColor: G+"40" }), opacity: manTicker.trim() ? 1 : .4 }}>
                    {validating ? "⟳" : "Validar"}
                  </button>
                </div>
                {valErr && <p style={{ fontSize: 12, color: RD, marginTop: 6 }}>{valErr}</p>}
                {!valErr && <p style={{ fontSize: 11, color: T3, marginTop: 6, lineHeight: 1.6 }}>
                  Xetra: SXR8.DE, VWCE.DE | SIX: NOVN.SW | LSE: CSPX.L | US: AAPL, MSFT | Cripto: BTC-USD
                </p>}
              </div>
              <div>
                <p style={{ fontSize: 11, color: T3, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>ETFs rápidos</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ETF_PICKS.map(item => (
                    <button key={item.sym} onClick={() => { setManTicker(item.sym); setValErr(""); }}
                      style={{ ...bsm({ fontSize: 11, padding: "5px 10px" }), color: manTicker === item.sym ? G : T2, borderColor: manTicker === item.sym ? G+"60" : BD2, background: manTicker === item.sym ? G+"12" : "transparent" }}>
                      {item.sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP: FORM */}
          {step === "form" && (
            <>
              {/* Asset badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: typeColor+"0d", border: "1.5px solid "+typeColor+"35", borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isFiat
                    ? <p style={{ fontSize: 14, fontWeight: 600, color: T }}>Dinheiro / Fiat</p>
                    : <>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T, fontFamily: "monospace", letterSpacing: .5 }}>{form.ticker}</p>
                        <p style={{ fontSize: 12, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.name}</p>
                      </>
                  }
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: typeColor, background: typeColor+"18", padding: "3px 9px", borderRadius: 20, fontWeight: 600, display: "block", marginBottom: 4 }}>
                    {typeLabel}
                  </span>
                  {validating && <span style={{ fontSize: 11, color: T3 }}>a buscar preço...</span>}
                  {livePrice && !validating && (
                    <div>
                      <span style={{ fontSize: 14, color: G, fontWeight: 700 }}>{fmtF(livePrice.price)} {livePrice.currency}</span>
                      <span style={{ fontSize: 11, color: livePrice.changePct >= 0 ? GR : RD, display: "block" }}>
                        {livePrice.changePct >= 0 ? "+" : ""}{(livePrice.changePct || 0).toFixed(2)}% hoje
                      </span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setStep("pick"); setLivePrice(null); setForm(f => ({ ...f, name: "", ticker: "", type: "etf" })); }} style={bsm({ padding: "4px 8px", fontSize: 12, color: T3 })}>×</button>
              </div>

              {/* Type picker */}
              {!isFiat && (
                <div>
                  <span style={lbl}>Tipo</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ASSET_TYPES.filter(a => a.key !== "fiat").map(a => (
                      <button key={a.key} onClick={() => setForm(f => ({ ...f, type: a.key }))}
                        style={{ ...bsm({ fontSize: 12, padding: "6px 12px" }), background: form.type === a.key ? a.color : "transparent", color: form.type === a.key ? "#111" : T2, border: "1px solid " + (form.type === a.key ? a.color : BD2) }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isFiat && (
                <div>
                  <span style={lbl}>Nome da conta *</span>
                  <input style={inp} placeholder="ex: UBS Conta Corrente" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={lbl}>Quantidade *</span>
                  <input style={inp} type="number" step="any" placeholder={isFiat ? "ex: 15000" : "ex: 10"} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <span style={lbl}>Moeda</span>
                  <select style={inp} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {!isFiat && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <span style={lbl}>Preço de compra</span>
                    <input style={inp} type="number" step="any" placeholder={livePrice ? "Atual: " + fmtF(livePrice.price) : "ex: 540.00"} value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} />
                  </div>
                  <div>
                    <span style={lbl}>Data de compra</span>
                    <input style={inp} type="date" value={form.buyDate} onChange={e => setForm(f => ({ ...f, buyDate: e.target.value }))} />
                  </div>
                </div>
              )}

              <div>
                <span style={lbl}>Notas (opcional)</span>
                <input style={inp} placeholder="ex: DCA mensal, lump sum..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button style={{ ...btn({ flex: 1 }) }} onClick={onClose}>Cancelar</button>
                <button style={{ ...btnG, flex: 1, opacity: canSave ? 1 : .4, cursor: canSave ? "pointer" : "not-allowed" }}
                  onClick={canSave ? save : undefined}>
                  Adicionar Ativo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PORTFOLIO CARD ──────────────────────────────────────────────────────────
function PortfolioCard({ pf, prices, fx, loading, onAddAsset, onDeleteAsset, onDelete, baseCurrency }) {
  const [open, setOpen] = useState(true);
  const pt    = PORTFOLIO_TYPES.find(t => t.key === pf.type) || PORTFOLIO_TYPES[5];
  const color = pf.color || G;
  const totalChf = pfValChf(pf, prices, fx);
  const total = toBaseCurrency(totalChf, baseCurrency, fx);
  const costChf  = pf.assets.reduce((s, a) => s + assetCostChf(a, fx), 0);
  const cost  = toBaseCurrency(costChf, baseCurrency, fx);
  const pnl   = total - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  return (
    <div style={{ ...card({ padding: 0, overflow: "hidden" }), borderTop: "3px solid "+color }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: T }}>{pf.name}</span>
            <span style={{ fontSize: 10, color, background: color+"18", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{pt.label}</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 3, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: G, fontWeight: 600 }}>{baseCurrency} {fmtF(total)}</span>
            {cost > 0 && <span style={{ fontSize: 12, color: pnl >= 0 ? GR : RD }}>{pnl >= 0 ? "+" : ""}{baseCurrency} {fmtF(Math.abs(pnl))} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>}
          </div>
        </div>
        <span style={{ fontSize: 13, color: T3, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid "+BD }}>
          {pf.assets.length === 0
            ? <p style={{ color: T3, fontSize: 13, padding: "22px", textAlign: "center" }}>Sem ativos. Adiciona um abaixo.</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid "+BD }}>
                      {["Ativo", "Qtd", "Compra", "Preço Atual", "Valor CHF", "P&L", ""].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: T2, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pf.assets.map(asset => {
                      const p      = asset.ticker ? prices[asset.ticker.toUpperCase()] : null;
                      const val    = assetValChf(asset, prices, fx);
                      const cost2  = assetCostChf(asset, fx);
                      const pl     = val !== null ? val - cost2 : null;
                      const plPct  = cost2 > 0 && pl !== null ? (pl / cost2) * 100 : null;
                      const isLoad = loading.has(asset.ticker?.toUpperCase());
                      const at     = ASSET_TYPES.find(a => a.key === asset.type);
                      return (
                        <tr key={asset.id} style={{ borderBottom: "1px solid "+BD }}>
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ fontWeight: 500, color: T }}>{asset.name || asset.ticker || "–"}</div>
                            {asset.ticker && <div style={{ fontSize: 11, color: G, fontFamily: "monospace" }}>{asset.ticker}</div>}
                            <div style={{ fontSize: 10, color: T3 }}>{at?.label} · {asset.currency}</div>
                          </td>
                          <td style={{ padding: "12px 12px", color: T2, fontFamily: "monospace", fontSize: 12 }}>
                            {(asset.quantity || 0).toLocaleString("de-CH", { maximumFractionDigits: 8 })}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {asset.buyPrice > 0
                              ? <><div style={{ color: T2 }}>{asset.currency} {fmtF(asset.buyPrice)}</div>{asset.buyDate && <div style={{ fontSize: 10, color: T3 }}>{fmtD(asset.buyDate)}</div>}</>
                              : <span style={{ color: T3 }}>–</span>}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {asset.type === "fiat" ? <span style={{ color: T3 }}>–</span>
                              : isLoad ? <span style={{ color: T3, fontSize: 12 }}>...</span>
                              : p ? <div>
                                  <div style={{ color: T }}>{asset.currency} {fmtF(p.price)}</div>
                                  <div style={{ fontSize: 11, color: p.changePct >= 0 ? GR : RD }}>{p.changePct >= 0 ? "+" : ""}{(p.changePct || 0).toFixed(2)}%</div>
                                </div>
                              : <span style={{ color: T3 }}>N/D</span>}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span style={{ color: G, fontWeight: 500 }}>{val !== null ? "CHF "+fmtF(val) : "–"}</span>
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {pl !== null
                              ? <div>
                                  <div style={{ color: pl >= 0 ? GR : RD, fontWeight: 500 }}>{pl >= 0 ? "+" : ""}CHF {fmtF(Math.abs(pl))}</div>
                                  {plPct !== null && <div style={{ fontSize: 11, color: pl >= 0 ? GR : RD }}>{plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%</div>}
                                </div>
                              : <span style={{ color: T3 }}>–</span>}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <button onClick={() => onDeleteAsset(pf.id, asset.id)} style={bsm({ color: RD, borderColor: RD+"25", padding: "3px 8px" })}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          <div style={{ padding: "12px 20px", borderTop: "1px solid "+BD, display: "flex", gap: 8 }}>
            <button style={bsm({ color: G, borderColor: G+"30" })} onClick={() => onAddAsset(pf.id)}>+ Ativo</button>
            <button style={bsm({ color: RD, borderColor: RD+"20", marginLeft: "auto" })} onClick={() => onDelete(pf.id)}>Remover Carteira</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PATRIMÔNIO ──────────────────────────────────────────────────────────────
function Patrimonio({ portfolios, savePortfolios, prices, setPrices, fx, setFx, nwHistory, saveNwHistory, baseCurrency, onUpdateBaseCurrency }) {
  const [loading,    setLoading]    = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRef,    setLastRef]    = useState(null);
  const [showAddPF,  setShowAddPF]  = useState(false);
  const [addFor,     setAddFor]     = useState(null);
  const [pfForm,     setPfForm]     = useState({ name: "", type: "bank", color: PALETTE[0] });

  const allTickers = useMemo(() => {
    const s = new Set();
    portfolios.forEach(p => p.assets.forEach(a => { if (a.ticker && a.type !== "fiat") s.add(a.ticker.toUpperCase()); }));
    return [...s];
  }, [portfolios]);

  const refreshPrices = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const newFx = await apiFxRates();
    setFx(newFx);
    if (allTickers.length > 0) {
      setLoading(new Set(allTickers));
      const batch = await apiBatchQuotes(allTickers);
      // Normalise keys to uppercase
      const norm = {};
      for (const [k, v] of Object.entries(batch)) norm[k.toUpperCase()] = v;
      setPrices(prev => ({ ...prev, ...norm }));
      setLoading(new Set());
    }
    setLastRef(new Date());
    // Auto-snapshot
    const nw = portfolios.reduce((s, p) => s + p.assets.reduce((as, a) => {
      if (a.type === "fiat") return as + (toChf(a.quantity, a.currency, newFx) ?? a.quantity);
      if (!a.ticker) return as;
      const p2 = prices[a.ticker.toUpperCase()];
      if (!p2) return as;
      return as + (toChf(a.quantity * p2.price, a.currency, newFx) ?? 0);
    }, 0), 0);
    if (nw > 0) {
      const today = new Date().toISOString().slice(0, 10);
      saveNwHistory(prev => {
        const upd = [...prev.filter(e => e.date !== today), { date: today, value: Math.round(nw) }].sort((a, b) => a.date.localeCompare(b.date));
        return upd;
      });
    }
    setRefreshing(false);
  }, [allTickers, portfolios, prices, refreshing, saveNwHistory]);

  useEffect(() => { if (allTickers.length > 0) refreshPrices(); }, []); // eslint-disable-line

  const totalChf  = useMemo(() => totalNW(portfolios, prices, fx), [portfolios, prices, fx]);
  const total     = toBaseCurrency(totalChf, baseCurrency, fx);
  const totalCostChf = useMemo(() => portfolios.reduce((s, p) => s + p.assets.reduce((as, a) => as + assetCostChf(a, fx), 0), 0), [portfolios, fx]);
  const totalCost = toBaseCurrency(totalCostChf, baseCurrency, fx);
  const pnl     = total - totalCost;
  const pnlPct  = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const chartData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hist  = nwHistory.filter(e => e.date !== today);
    const all   = total > 0 ? [...hist, { date: today, value: Math.round(total) }] : hist;
    return all.map(e => ({
      label: fmtDs(e.date),
      value: toBaseCurrency(e.value, baseCurrency, fx),
    }));
  }, [nwHistory, total, baseCurrency, fx]);

  const savePf = (upd) => { savePortfolios(upd); };
  const addPortfolio = () => {
    if (!pfForm.name.trim()) return;
    savePf([...portfolios, { ...pfForm, id: Date.now(), assets: [] }]);
    setShowAddPF(false); setPfForm({ name: "", type: "bank", color: PALETTE[0] });
  };
  const deletePortfolio = (id) => savePf(portfolios.filter(p => p.id !== id));
  const onSaveAsset = (asset) => {
    const upd = portfolios.map(p => p.id === addFor ? { ...p, assets: [...p.assets, asset] } : p);
    savePf(upd); setAddFor(null);
    if (asset.ticker && asset.type !== "fiat") {
      setTimeout(async () => {
        const q = await apiSingleQuote(asset.ticker);
        if (q) setPrices(prev => ({ ...prev, [asset.ticker.toUpperCase()]: q }));
      }, 300);
    }
  };
  const deleteAsset = (pid, aid) => savePf(portfolios.map(p => p.id === pid ? { ...p, assets: p.assets.filter(a => a.id !== aid) } : p));

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Patrimônio</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={baseCurrency} onChange={e => onUpdateBaseCurrency(e.target.value)} style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 12, background: S2, border: "1px solid "+BD2 }}>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <button style={bsm({ color: BL, borderColor: BL+"30", opacity: refreshing ? .6 : 1 })} onClick={refreshPrices} disabled={refreshing}>
            {refreshing ? "a actualizar..." : "↻ Actualizar Preços"}
          </button>
          <button style={btnG} onClick={() => setShowAddPF(true)}>+ Carteira</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Patrimônio Total", val: baseCurrency+" "+fmtF(total), sub: ((total/toBaseCurrency(TARGET, baseCurrency, fx))*100).toFixed(2)+"% do objetivo", color: G },
          { label: "Total Investido",  val: baseCurrency+" "+fmtF(totalCost), sub: "custo de aquisição" },
          { label: "P&L Total",        val: (pnl >= 0 ? "+" : "")+baseCurrency+" "+fmtF(Math.abs(pnl)), sub: (pnlPct >= 0 ? "+" : "")+pnlPct.toFixed(1)+"%", color: pnl >= 0 ? GR : RD },
        ].map(s => (
          <div key={s.label} style={{ ...card({ padding: "16px 18px" }), borderColor: s.color ? s.color+"35" : BD }}>
            <p style={{ fontSize: 11, color: T2, marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 16, color: s.color || T, fontWeight: 600, lineHeight: 1.2 }}>{s.val}</p>
            <p style={{ fontSize: 11, color: T3, marginTop: 5 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ ...card({ padding: "16px 18px", marginBottom: 20 }) }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: T2 }}>Rota ao Milhão</span>
          <span style={{ fontSize: 13, color: G, fontWeight: 600 }}>{((total/TARGET)*100).toFixed(2)}%</span>
        </div>
        <ProgressBar value={total} max={TARGET} height={8} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {lastRef && <p style={{ fontSize: 11, color: T3 }}>Actualizado: {lastRef.toLocaleTimeString("pt-PT")}</p>}
          <p style={{ fontSize: 11, color: T3 }}>EUR/CHF {(fx.EUR||0).toFixed(4)} · USD/CHF {(fx.USD||0).toFixed(4)} · GBP/CHF {(fx.GBP||0).toFixed(4)}</p>
        </div>
      </div>

      <div style={{ ...card({ marginBottom: 20, padding: "20px 18px 8px" }) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: T2, fontWeight: 600, letterSpacing: 1 }}>EVOLUÇÃO DO PATRIMÔNIO</p>
          <span style={{ fontSize: 11, color: T3 }}>{chartData.length} ponto{chartData.length === 1 ? "" : "s"}</span>
        </div>
        <NwChart data={chartData} baseCurrency={baseCurrency} />
      </div>

      {portfolios.length === 0
        ? <div style={{ ...card({ padding: "50px 20px", textAlign: "center" }) }}>
            <p style={{ color: T2, fontSize: 15, marginBottom: 8 }}>Nenhuma carteira ainda</p>
            <p style={{ color: T3, fontSize: 13, marginBottom: 20 }}>Adiciona o teu banco, corretora ou exchange.</p>
            <button style={btnG} onClick={() => setShowAddPF(true)}>+ Adicionar Carteira</button>
          </div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {portfolios.map(p => (
              <PortfolioCard key={p.id} pf={p} prices={prices} fx={fx} loading={loading}
                onAddAsset={id => setAddFor(id)} onDeleteAsset={deleteAsset} onDelete={deletePortfolio} baseCurrency={baseCurrency} />
            ))}
          </div>
      }

      <div style={{ marginTop: 20 }}>
        <Marcos portfolios={portfolios} prices={prices} fx={fx} baseCurrency={baseCurrency} embedded />
      </div>

      {showAddPF && (
        <Modal title="Nova Carteira" onClose={() => setShowAddPF(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><span style={lbl}>Nome *</span><input style={inp} placeholder="ex: UBS, Interactive Brokers, Binance" value={pfForm.name} onChange={e => setPfForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><span style={lbl}>Tipo</span>
              <select style={inp} value={pfForm.type} onChange={e => setPfForm(f => ({ ...f, type: e.target.value }))}>
                {PORTFOLIO_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div><span style={lbl}>Cor</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => setPfForm(f => ({ ...f, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: "3px solid "+(pfForm.color === c ? T : "transparent"), boxSizing: "border-box" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...btn({ flex: 1 }) }} onClick={() => setShowAddPF(false)}>Cancelar</button>
              <button style={{ ...btnG, flex: 1 }} onClick={addPortfolio}>Criar Carteira</button>
            </div>
          </div>
        </Modal>
      )}
      {addFor !== null && <AddAssetModal onClose={() => setAddFor(null)} onSave={onSaveAsset} />}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ portfolios, prices, fx, nwHistory, ideas, goals, startDate, baseCurrency }) {
  const nwChf = totalNW(portfolios, prices, fx);
  const nw    = toBaseCurrency(nwChf, baseCurrency, fx);
  const pct   = Math.min((nw / toBaseCurrency(TARGET, baseCurrency, fx)) * 100, 100);
  const days  = startDate ? Math.floor((Date.now() - new Date(startDate)) / 86400000) : 0;
  const nextM = MILESTONES.find(m => m.amount > nw);
  const hist  = [...nwHistory].sort((a, b) => a.date.localeCompare(b.date));
  const prev  = hist.length > 1 ? hist[hist.length - 2].value : null;
  const delta = prev !== null ? nw - toBaseCurrency(prev, baseCurrency, fx) : null;
  const wBreak = portfolios.map(p => ({ ...p, t: pfValChf(p, prices, fx) })).sort((a, b) => b.t - a.t);
  const quotes = ["O caminho para o milhão começa com o primeiro franco.", "Consistência supera intensidade. Sempre.", "Cada ideia avaliada é um passo em frente.", "O melhor momento para investir foi ontem. O segundo melhor é hoje.", "Mede o que importa. Melhora o que medes.", "Riqueza é o que acumulas, não o que gastas."];
  const quote = quotes[new Date().getDay() % quotes.length];

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ ...card({ marginBottom: 20, background: "linear-gradient(135deg,#18150a 0%,#141418 100%)", borderColor: G+"30" }) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, color: G, letterSpacing: 1.5, marginBottom: 8 }}>PATRIMÔNIO ATUAL</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 42, color: T, lineHeight: 1 }}>{baseCurrency} {fmtN(nw)}</p>
            {delta !== null && <p style={{ fontSize: 13, color: delta >= 0 ? GR : RD, marginTop: 6 }}>{delta >= 0 ? "+" : "–"} {baseCurrency} {fmtN(Math.abs(delta))} vs última entrada</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: T2, marginBottom: 4 }}>Objetivo</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: G }}>CHF 1.000.000</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T2 }}>Progresso total</span>
          <span style={{ fontSize: 13, color: G, fontWeight: 600 }}>{pct.toFixed(2)}%</span>
        </div>
        <ProgressBar value={nw} max={TARGET} height={10} />
        {nextM && <div style={{ marginTop: 14, padding: "10px 14px", background: G+"10", borderRadius: 8, border: "1px solid "+G+"20" }}>
          <p style={{ fontSize: 12, color: T2 }}>Próximo marco: <span style={{ color: G, fontWeight: 600 }}>{nextM.label}</span> · falta <span style={{ color: T }}>CHF {fmtN(nextM.amount - nw)}</span></p>
        </div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Dias na jornada", val: days, sub: startDate ? "desde "+fmtD(startDate) : "início" },
          { label: "Fontes ativas",   val: ideas.filter(i => i.status === "active").length, sub: "rendimento" },
          { label: "Objetivos",       val: goals.filter(g => g.current >= g.target).length+"/"+goals.length, sub: "concluídos" },
        ].map(s => (
          <div key={s.label} style={card({ padding: "16px 18px" })}>
            <p style={{ fontSize: 11, color: T2, marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: T, lineHeight: 1 }}>{s.val}</p>
            <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {wBreak.length > 0 && (
        <div style={{ ...card({ marginBottom: 20 }) }}>
          <p style={{ fontSize: 12, color: T2, fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>CARTEIRAS</p>
          {wBreak.map((w, i) => {
            const pt = PORTFOLIO_TYPES.find(t => t.key === w.type) || PORTFOLIO_TYPES[5];
            const share = nw > 0 ? (w.t / nw) * 100 : 0;
            return (
              <div key={w.id} style={{ paddingBottom: i < wBreak.length - 1 ? 12 : 0, marginBottom: i < wBreak.length - 1 ? 12 : 0, borderBottom: i < wBreak.length - 1 ? "1px solid "+BD : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: T }}>{w.name}</span>
                    <span style={{ fontSize: 10, color: pt.color }}>{pt.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 11, color: T2 }}>{share.toFixed(1)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T }}>CHF {fmtN(w.t)}</span>
                  </div>
                </div>
                <ProgressBar value={w.t} max={nw} color={pt.color} height={3} />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...card({ borderLeft: "3px solid "+G, borderRadius: "0 12px 12px 0" }) }}>
        <p style={{ fontSize: 14, color: T2, fontStyle: "italic", lineHeight: 1.6 }}>"{quote}"</p>
      </div>
    </div>
  );
}

// ─── IDEIAS ──────────────────────────────────────────────────────────────────
function Ideias({ ideas, saveIdeas }) {
  const [filter, setFilter] = useState("all");
  const [show,   setShow]   = useState(false);
  const [edit,   setEdit]   = useState(null);
  const emp = { title: "", description: "", category: "Digital", feasibility: 3, potential: 3, status: "idea", notes: "" };
  const [form, setForm] = useState(emp);
  const save = () => {
    if (!form.title.trim()) return;
    if (edit) saveIdeas(ideas.map(i => i.id === edit ? { ...form, id: edit } : i));
    else saveIdeas([...ideas, { ...form, id: Date.now() }]);
    setShow(false); setEdit(null); setForm(emp);
  };
  const filtered = (filter === "all" ? ideas : ideas.filter(i => i.status === filter)).slice().sort((a, b) => (b.potential + b.feasibility) - (a.potential + a.feasibility));
  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Ideias</h2>
        <button style={btnG} onClick={() => { setForm(emp); setEdit(null); setShow(true); }}>+ Nova Ideia</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ key: "all", label: "Todas ("+ideas.length+")" }, ...IDEA_STATUSES.map(s => ({ key: s.key, label: s.label+" ("+ideas.filter(i => i.status === s.key).length+")" }))].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...bsm({ padding: "7px 14px", fontSize: 12 }), background: filter === f.key ? G : "transparent", color: filter === f.key ? "#1a1205" : T2, border: "1px solid "+(filter === f.key ? G : BD2) }}>{f.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(idea => {
          const si = IDEA_STATUSES.find(x => x.key === idea.status) || IDEA_STATUSES[0];
          return (
            <div key={idea.id} style={card()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: T }}>{idea.title}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, border: "1px solid "+si.color+"40", color: si.color, background: si.color+"15" }}>{si.label}</span>
                <span style={{ fontSize: 11, color: T3, background: S3, padding: "2px 8px", borderRadius: 20 }}>{idea.category}</span>
              </div>
              {idea.description && <p style={{ fontSize: 13, color: T2, lineHeight: 1.5, marginBottom: 10 }}>{idea.description}</p>}
              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                <div><p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>POTENCIAL</p><Stars value={idea.potential} /></div>
                <div><p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>VIABILIDADE</p><Stars value={idea.feasibility} /></div>
              </div>
              {idea.notes && <p style={{ fontSize: 12, color: T3, fontStyle: "italic", marginBottom: 10 }}>{idea.notes}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={idea.status} onChange={e => saveIdeas(ideas.map(i => i.id === idea.id ? { ...i, status: e.target.value } : i))} style={{ ...inp, width: "auto", padding: "5px 10px", fontSize: 12 }}>
                  {IDEA_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button onClick={() => { setForm({ ...idea }); setEdit(idea.id); setShow(true); }} style={bsm()}>Editar</button>
                <button onClick={() => saveIdeas(ideas.filter(i => i.id !== idea.id))} style={bsm({ color: RD, borderColor: RD+"30" })}>×</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ color: T3, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Nenhuma ideia aqui.</p>}
      </div>
      {show && (
        <Modal title={edit ? "Editar Ideia" : "Nova Ideia"} onClose={() => { setShow(false); setEdit(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><span style={lbl}>Nome *</span><input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: Newsletter sobre finanças" /></div>
            <div><span style={lbl}>Descrição</span><textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Categoria</span><select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{IDEA_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><span style={lbl}>Estado</span><select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{IDEA_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Potencial</span><Stars value={form.potential} onChange={v => setForm(f => ({ ...f, potential: v }))} /></div>
              <div><span style={lbl}>Viabilidade</span><Stars value={form.feasibility} onChange={v => setForm(f => ({ ...f, feasibility: v }))} /></div>
            </div>
            <div><span style={lbl}>Notas</span><textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...btn({ flex: 1 }) }} onClick={() => { setShow(false); setEdit(null); }}>Cancelar</button>
              <button style={{ ...btnG, flex: 1 }} onClick={save}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── OBJETIVOS ───────────────────────────────────────────────────────────────
function Objetivos({ goals, saveGoals, onAddCalendarTask }) {
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [aiByGoal, setAiByGoal] = useState({});
  const emp = { title: "", category: "Financeiro", current: 0, target: 0, unit: "CHF", deadline: "", notes: "" };
  const [form, setForm] = useState(emp);
  const CATS = ["Financeiro", "Hábito", "Aprendizagem", "Projeto", "Outro"];
  const COLS = { Financeiro: G, Hábito: GR, Aprendizagem: BL, Projeto: PU, Outro: T2 };
  const save = () => {
    if (!form.title.trim() || !form.target) return;
    const g = { ...form, target: parseFloat(form.target), current: parseFloat(form.current) || 0 };
    if (edit) saveGoals(goals.map(x => x.id === edit ? { ...g, id: edit } : x));
    else saveGoals([...goals, { ...g, id: Date.now() }]);
    setShow(false); setEdit(null); setForm(emp);
  };

  const loadAiSuggestions = async (goal) => {
    setAiByGoal(prev => ({
      ...prev,
      [goal.id]: { ...(prev[goal.id] || {}), loading: true, error: "" },
    }));

    try {
      const suggestions = await apiGoalSuggestions(goal);
      const timestamp = Date.now();
      const newEntries = suggestions.slice(0, 2).map((item, idx) => ({
        id: timestamp + idx + Math.floor(Math.random() * 1000),
        title: item.title,
        notes: item.notes || "",
        createdAt: new Date().toISOString(),
      }));

      if (newEntries.length > 0) {
        saveGoals(goals.map(x => x.id === goal.id
          ? { ...x, aiSuggestions: [...newEntries, ...(x.aiSuggestions || [])] }
          : x));
      }

      setAiByGoal(prev => ({
        ...prev,
        [goal.id]: { loading: false, error: "" },
      }));
    } catch (error) {
      setAiByGoal(prev => ({
        ...prev,
        [goal.id]: {
          loading: false,
          error: error.message || "Erro ao gerar sugestões",
        },
      }));
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Objetivos</h2>
        <button style={btnG} onClick={() => { setForm(emp); setEdit(null); setShow(true); }}>+ Novo Objetivo</button>
      </div>
      {goals.length === 0
        ? <div style={{ ...card({ padding: "60px 20px", textAlign: "center" }) }}>
            <p style={{ color: T2, fontSize: 15, marginBottom: 8 }}>Nenhum objetivo definido</p>
            <p style={{ color: T3, fontSize: 13 }}>Define marcos e hábitos para acelerar a jornada.</p>
          </div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {goals.map(g => {
              const pct   = Math.min((g.current / g.target) * 100, 100);
              const color = COLS[g.category] || T2;
              const done  = g.current >= g.target;
              const dl    = g.deadline ? Math.floor((new Date(g.deadline) - Date.now()) / 86400000) : null;
              const aiState = aiByGoal[g.id] || { loading: false, error: "" };
              const suggestionHistory = g.aiSuggestions || [];
              return (
                <div key={g.id} style={{ ...card({ borderLeft: "3px solid "+color, borderRadius: "0 12px 12px 0" }) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: done ? GR : T }}>{g.title}</span>
                        <span style={{ fontSize: 10, color, background: color+"18", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{g.category}</span>
                        {done && <span style={{ fontSize: 10, color: GR, background: GR+"18", padding: "2px 8px", borderRadius: 20 }}>✓ CONCLUÍDO</span>}
                      </div>
                      <p style={{ fontSize: 13, color: T2 }}>
                        {g.unit === "CHF" ? "CHF "+(g.current||0).toLocaleString("de-CH")+" / CHF "+(g.target||0).toLocaleString("de-CH") : g.current+" / "+g.target+" "+g.unit}
                        {dl !== null && <span style={{ color: dl < 7 ? RD : T3, marginLeft: 10 }}>{dl < 0 ? "expirado" : dl+"d"}</span>}
                      </p>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 600, color }}>{Math.round(pct)}%</span>
                  </div>
                  <ProgressBar value={g.current} max={g.target} color={done ? GR : color} height={6} />
                  {g.notes && <p style={{ fontSize: 12, color: T3, fontStyle: "italic", marginTop: 8 }}>{g.notes}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <input type="number" placeholder="Progresso actual" value={g.current || ""}
                      onChange={e => saveGoals(goals.map(x => x.id === g.id ? { ...x, current: parseFloat(e.target.value) || 0 } : x))}
                      style={{ ...inp, width: 140, padding: "6px 10px", fontSize: 13 }} />
                    <button onClick={() => { setForm({ ...g }); setEdit(g.id); setShow(true); }} style={bsm()}>Editar</button>
                    <button
                      onClick={() => loadAiSuggestions(g)}
                      disabled={aiState.loading}
                      style={{ ...bsm({ color: BL, borderColor: BL+"30" }), opacity: aiState.loading ? 0.65 : 1 }}>
                      {aiState.loading ? "AI..." : "Sugestões AI"}
                    </button>
                    <button onClick={() => saveGoals(goals.filter(x => x.id !== g.id))} style={bsm({ color: RD, borderColor: RD+"30" })}>×</button>
                  </div>

                  {(aiState.error || suggestionHistory.length > 0) && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {aiState.error && (
                        <p style={{ fontSize: 12, color: RD }}>{aiState.error}</p>
                      )}

                      {suggestionHistory.map((suggestion) => (
                        <div key={suggestion.id} style={{ background: S2, border: "1px solid " + BD, borderRadius: 10, padding: "10px 12px" }}>
                          <p style={{ fontSize: 13, color: T, fontWeight: 600 }}>{suggestion.title}</p>
                          {suggestion.notes && <p style={{ fontSize: 12, color: T3, marginTop: 4, lineHeight: 1.5 }}>{suggestion.notes}</p>}
                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => onAddCalendarTask?.(g, suggestion)}
                              style={bsm({ color: G, borderColor: G + "30", fontSize: 11, padding: "5px 10px" })}>
                              + Adicionar ao calendário
                            </button>
                            <button
                              onClick={() => saveGoals(goals.map(x => x.id === g.id
                                ? { ...x, aiSuggestions: (x.aiSuggestions || []).filter(s => s.id !== suggestion.id) }
                                : x))}
                              style={bsm({ color: RD, borderColor: RD + "30", fontSize: 11, padding: "5px 10px" })}>
                              Apagar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
      {show && (
        <Modal title={edit ? "Editar Objetivo" : "Novo Objetivo"} onClose={() => { setShow(false); setEdit(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><span style={lbl}>Título *</span><input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: Fundo de emergência 20.000 CHF" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Categoria</span><select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><span style={lbl}>Unidade</span><select style={inp} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{["CHF", "%", "h/sem", "vezes", "livros", "outro"].map(u => <option key={u}>{u}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Actual</span><input style={inp} type="number" value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} /></div>
              <div><span style={lbl}>Objetivo *</span><input style={inp} type="number" placeholder="ex: 20000" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
            </div>
            <div><span style={lbl}>Prazo</span><input style={inp} type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            <div><span style={lbl}>Notas</span><input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...btn({ flex: 1 }) }} onClick={() => { setShow(false); setEdit(null); }}>Cancelar</button>
              <button style={{ ...btnG, flex: 1 }} onClick={save}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MARCOS ──────────────────────────────────────────────────────────────────
function Marcos({ portfolios, prices, fx, baseCurrency, embedded = false }) {
  const nwChf = totalNW(portfolios, prices, fx);
  const nw = toBaseCurrency(nwChf, baseCurrency, fx);
  return (
    <div style={{ paddingBottom: embedded ? 0 : 40 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T, marginBottom: 8 }}>Marcos da Jornada</h2>
      <p style={{ color: T2, fontSize: 14, marginBottom: 24 }}>Os teus pontos de chegada no caminho para o milhão.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {MILESTONES.map((m, i) => {
          const done   = nw >= m.amount;
          const active = !done && (i === 0 || nw >= MILESTONES[i - 1].amount);
          const pct    = Math.min((nw / m.amount) * 100, 100);
          return (
            <div key={m.amount} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? G : active ? G+"25" : S3, border: "2px solid "+(done ? GL : active ? G : BD2), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: done ? "#1a1205" : active ? G : T3, fontWeight: 700, zIndex: 1, flexShrink: 0 }}>
                  {done ? "✓" : i + 1}
                </div>
                {i < MILESTONES.length - 1 && <div style={{ width: 2, flex: 1, background: done ? G+"40" : BD, margin: "4px 0" }} />}
              </div>
              <div style={{ ...card({ flex: 1, marginBottom: i < MILESTONES.length - 1 ? 8 : 0, borderColor: done ? G+"40" : active ? G+"20" : BD, background: done ? G+"08" : active ? G+"03" : S1 }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: done ? G : active ? T : T2, marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 13, color: T2 }}>{baseCurrency} {fmtN(toBaseCurrency(m.amount, baseCurrency, fx))}</p>
                  </div>
                  {done ? <span style={{ fontSize: 11, color: G, background: G+"18", padding: "4px 12px", borderRadius: 20 }}>ALCANÇADO</span>
                    : active ? <span style={{ fontSize: 11, color: G, background: G+"10", padding: "4px 12px", borderRadius: 20, border: "1px solid "+G+"30" }}>EM CURSO</span> : null}
                </div>
                {!done && <div style={{ marginTop: 10 }}>
                  <ProgressBar value={nw} max={m.amount} color={active ? G : T3} height={4} />
                  <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>Faltam {baseCurrency} {fmtN(toBaseCurrency(m.amount, baseCurrency, fx) - nw)} ({pct.toFixed(1)}%)</p>
                </div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CHATBOT ────────────────────────────────────────────────────────────────
function Chatbot({ portfolios, prices, fx, goals, ideas, nwHistory, startDate, baseCurrency }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build detailed context
    const totalNWValue = toBaseCurrency(totalNW(portfolios, prices, fx), baseCurrency, fx);
    const progress = ((totalNWValue / TARGET) * 100).toFixed(2);

    const detailedContext = {
      portfolios: portfolios.map(p => ({
        name: p.name,
        type: p.type,
        assets: p.assets.map(a => ({
          name: a.name,
          ticker: a.ticker,
          type: a.type,
          quantity: a.quantity,
          buyPrice: a.buyPrice,
          buyDate: a.buyDate,
          notes: a.notes,
          currency: a.currency,
        })),
      })),
      goals: goals.map(g => ({
        title: g.title,
        category: g.category,
        current: g.current,
        target: g.target,
        unit: g.unit,
        deadline: g.deadline,
        notes: g.notes,
      })),
      ideas: ideas.map(i => ({
        title: i.title,
        description: i.description,
        category: i.category,
        status: i.status,
        potential: i.potential,
        feasibility: i.feasibility,
        notes: i.notes,
      })),
      totalNW: fmtN(totalNWValue),
      progress,
      nwHistory: nwHistory.map(h => ({ date: h.date, value: h.value })),
      startDate,
      baseCurrency,
      prices: Object.keys(prices).slice(0, 10).reduce((obj, key) => { obj[key] = prices[key]; return obj; }, {}), // limit to 10
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: detailedContext,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Erro ao conectar com o chatbot.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 90,
            ...btnG,
            padding: "10px 14px",
            borderRadius: 999,
            boxShadow: "0 10px 24px rgba(0,0,0,.35)",
          }}>
          Chat
        </button>
      )}

      {open && (
        <div style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 90,
          width: 350,
          height: 470,
          display: "flex",
          flexDirection: "column",
          background: S1,
          border: "1px solid " + BD2,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 18px 36px rgba(0,0,0,.45)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid " + BD }}>
            <p style={{ fontSize: 13, color: T, fontWeight: 600 }}>Assistente</p>
            <button onClick={() => setOpen(false)} style={bsm({ padding: "4px 10px" })}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: T3, fontSize: 13, marginTop: 72 }}>
                <p>Olá! Sou teu assistente.</p>
                <p>Pergunta sobre ativos, objetivos ou notícias.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '8px 10px',
                  borderRadius: 11,
                  background: msg.role === 'user' ? G : S2,
                  color: msg.role === 'user' ? '#1a1205' : T,
                  fontSize: 13,
                  lineHeight: 1.35,
                }}>
                  {msg.role === 'bot' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ ...card({ padding: '8px 10px', background: S2 }), color: T3, fontSize: 12 }}>
                  Digitando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ borderTop: '1px solid ' + BD, padding: '10px', display: 'flex', gap: 6 }}>
            <input
              style={{ ...inp, flex: 1, padding: "8px 10px" }}
              placeholder="Escreve..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button style={{ ...btnG, padding: "8px 10px" }} onClick={sendMessage} disabled={loading || !input.trim()}>
              ↵
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AuthScreen({ hasUsers, onAuthenticated }) {
  const [mode, setMode] = useState(hasUsers ? "login" : "register");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(hasUsers ? "login" : "register");
  }, [hasUsers]);

  const isRegister = mode === "register";

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Preenche o email e a password.");
      return;
    }

    if (isRegister && form.name.trim().length < 2) {
      setError("Indica um nome com pelo menos 2 caracteres.");
      return;
    }

    if (isRegister && form.password.length < 8) {
      setError("A password deve ter pelo menos 8 caracteres.");
      return;
    }

    if (isRegister && form.password !== form.confirmPassword) {
      setError("As passwords não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiAuthRequest(`/api/auth/${mode}`, {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at top, ${S2} 0%, ${BG} 55%)`, color: T, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 980, display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 24, alignItems: "stretch" }}>
        <div style={{ ...card({ padding: "34px 34px 30px", background: `linear-gradient(180deg, ${S1}, ${BG})`, display: "flex", flexDirection: "column", justifyContent: "space-between" }) }}>
          <div>
            <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.4, color: G, fontWeight: 700, marginBottom: 14 }}>SQLite Local</p>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 42, lineHeight: 1.05, marginBottom: 14 }}>Rota ao Milhão</h1>
            <p style={{ color: T2, fontSize: 15, lineHeight: 1.7, maxWidth: 430 }}>
              A app passa agora a ter autenticação local com base de dados SQLite. O acesso ao dashboard fica protegido por sessão com cookie seguro no browser.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 28 }}>
            {[
              { title: "BD local", text: "Ficheiro SQLite criado localmente em data/app.db." },
              { title: "Sessão", text: "Login persistido com cookie httpOnly." },
              { title: "Arranque", text: hasUsers ? "Entra com a tua conta para abrir a app." : "Cria a primeira conta para inicializar a app." },
            ].map(item => (
              <div key={item.title} style={{ background: S2, border: "1px solid " + BD, borderRadius: 12, padding: "14px 14px 12px" }}>
                <p style={{ fontSize: 13, color: T, fontWeight: 600, marginBottom: 6 }}>{item.title}</p>
                <p style={{ fontSize: 12, color: T3, lineHeight: 1.6 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card({ padding: "30px 28px", alignSelf: "center" }) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: T }}>{isRegister ? "Criar conta" : "Entrar"}</p>
              <p style={{ color: T3, fontSize: 13, marginTop: 5 }}>
                {isRegister ? "A conta fica guardada na tua base de dados local." : "Autentica-te para abrir o teu dashboard."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 4, border: "1px solid " + BD2, borderRadius: 10, padding: 3 }}>
              {["login", "register"].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setMode(tab); setError(""); }}
                  style={{
                    ...bsm({ border: "none", padding: "8px 14px", borderRadius: 8 }),
                    background: mode === tab ? G : "transparent",
                    color: mode === tab ? "#1a1205" : T2,
                    fontWeight: mode === tab ? 700 : 500,
                  }}>
                  {tab === "login" ? "Login" : "Registar"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isRegister && (
              <div>
                <span style={lbl}>Nome</span>
                <input
                  style={inp}
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="O teu nome"
                />
              </div>
            )}

            <div>
              <span style={lbl}>Email</span>
              <input
                style={inp}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="tu@exemplo.com"
              />
            </div>

            <div>
              <span style={lbl}>Password</span>
              <input
                style={inp}
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            {isRegister && (
              <div>
                <span style={lbl}>Confirmar password</span>
                <input
                  style={inp}
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Repete a password"
                />
              </div>
            )}

            {error && (
              <div style={{ background: RD + "14", border: "1px solid " + RD + "35", color: RD, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button type="submit" style={{ ...btnG, width: "100%", justifyContent: "center", marginTop: 4, opacity: submitting ? 0.75 : 1 }} disabled={submitting}>
              {submitting ? "A processar..." : isRegister ? "Criar conta e entrar" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ────────────────────────────────────────────────────────────────
export default function App() {
  const [section,      setSection]      = useState("patrimonio");
  const [isMobile,     setIsMobile]     = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("CHF");
  const [portfolios,   setPortfolios]   = useState([]);
  const [prices,       setPrices]       = useState({});
  const [fx,           setFx]           = useState({ EUR: 0.94, USD: 0.89, GBP: 1.13 });
  const [nwHistory,    setNwHistory]    = useState([]);
  const [ideas,        setIdeas]        = useState([]);
  const [goals,        setGoals]        = useState([]);
  const [calendarSlots,setCalendarSlots]= useState([]);
  const [calendarSlotPrefill, setCalendarSlotPrefill] = useState(null);
  const [startDate,    setStartDate]    = useState(null);
  const [loaded,       setLoaded]       = useState(false);
  const [user,         setUser]         = useState(null);
  const [hasUsers,     setHasUsers]     = useState(true);
  const dataRef = useRef({
    portfolios: [],
    nwHistory: [],
    ideas: [],
    goals: [],
    startDate: null,
    baseCurrency: "CHF",
    calendarSlots: [],
  });

  const applyUserData = useCallback((data) => {
    const next = {
      portfolios: data?.portfolios || [],
      nwHistory: data?.nwHistory || [],
      ideas: data?.ideas || [],
      goals: data?.goals || [],
      startDate: data?.startDate || null,
      baseCurrency: data?.baseCurrency || "CHF",
      calendarSlots: data?.calendarSlots || [],
    };

    dataRef.current = next;
    setPortfolios(next.portfolios);
    setNwHistory(next.nwHistory);
    setIdeas(next.ideas);
    setGoals(next.goals);
    setCalendarSlots(next.calendarSlots);
    setStartDate(next.startDate);
    setBaseCurrency(next.baseCurrency);
  }, []);

  const persistUserData = useCallback(async (updater) => {
    const patch = typeof updater === "function" ? updater(dataRef.current) : updater;
    const next = { ...dataRef.current, ...patch };

    applyUserData(next);

    try {
      const saved = await apiSaveUserData(next);
      applyUserData(saved);
    } catch (error) {
      console.error("[user-data] save failed", error);
    }
  }, [applyUserData]);

  useEffect(() => {
    async function bootstrap() {
      const localData = readLocalAppData();

      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        setUser(data.user || null);
        setHasUsers(Boolean(data.hasUsers));

        if (data.user) {
          const remoteData = await apiGetUserData();
          if (isEmptyRemoteData(remoteData) && hasMeaningfulAppData(localData)) {
            const migrated = await apiSaveUserData(localData);
            applyUserData(migrated);
          } else {
            applyUserData(remoteData);
          }
        } else {
          applyUserData({});
        }
      } catch {
        setUser(null);
        setHasUsers(false);
        applyUserData({});
      } finally {
        setLoaded(true);
      }
    }

    bootstrap();
  }, [applyUserData]);

  const savePortfolios = useCallback((valueOrUpdater) => {
    persistUserData(prev => ({
      portfolios: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.portfolios) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveNwHistory = useCallback((valueOrUpdater) => {
    persistUserData(prev => ({
      nwHistory: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.nwHistory) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveIdeas = useCallback((valueOrUpdater) => {
    persistUserData(prev => ({
      ideas: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.ideas) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveGoals = useCallback((valueOrUpdater) => {
    persistUserData(prev => ({
      goals: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.goals) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveCalendarSlots = useCallback((valueOrUpdater) => {
    persistUserData(prev => ({
      calendarSlots: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.calendarSlots) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const updateBaseCurrency = useCallback((value) => {
    persistUserData({ baseCurrency: value });
  }, [persistUserData]);

  const addGoalSuggestionToCalendar = useCallback((goal, suggestion) => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const date = todayIso;
    const startHour = Math.min(Math.max(now.getHours() + 1, 8), 22);
    const endHour = Math.min(startHour + 1, 23);

    const catMap = {
      Financeiro: "finance",
      Hábito: "health",
      Aprendizagem: "learning",
      Projeto: "work",
      Outro: "other",
    };

    const slot = {
      requestId: Date.now() + Math.floor(Math.random() * 1000),
      title: suggestion?.title || `Passo para objetivo: ${goal?.title || "Objetivo"}`,
      category: catMap[goal?.category] || "other",
      status: "todo",
      date,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
      notes: suggestion?.notes || `Tarefa criada a partir do objetivo "${goal?.title || "Objetivo"}"`,
      recurring: "none",
    };

    setSection("calendario");
    setCalendarSlotPrefill(slot);
  }, []);

  const consumeCalendarSlotPrefill = useCallback(() => {
    setCalendarSlotPrefill(null);
  }, []);

  const NAV = [
    { key: "patrimonio", label: "Patrimônio" },
    { key: "ideias",     label: "Ideias" },
    { key: "objetivos",  label: "Objetivos" },
    { key: "calendario", label: "Calendário" },
  ];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 900);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    applyUserData({});
    setSection("patrimonio");
  }, [applyUserData]);

  if (!loaded) return (
    <div style={{ fontFamily: "'Outfit',sans-serif", background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T2 }}>
      <p>A carregar...</p>
    </div>
  );

  return (
    <>
      <Head>
        <title>Ascent</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet" />
      </Head>

      {!user ? (
        <AuthScreen
          hasUsers={hasUsers}
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setHasUsers(true);
            apiGetUserData().then(applyUserData).catch(() => applyUserData({}));
          }}
        />
      ) : (
      <div style={{ fontFamily: "'Outfit',sans-serif", background: BG, minHeight: "100vh", color: T }}>
        <style>{`*{box-sizing:border-box;margin:0;padding:0;}body{background:${BG};}input[type=number]::-webkit-inner-spin-button{opacity:.3;}select option{background:${S2};color:${T};}`}</style>

        {/* Header */}
        <div style={{ background: S1+"ee", backdropFilter: "blur(12px)", borderBottom: "1px solid "+BD, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "10px 24px" : "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 58, gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: G }} />
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T }}>ASCENT</span>
            </div>
            {isMobile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", width: "100%" }}>
                <span style={{ fontSize: 12, color: T2 }}>{user.name}</span>
                <select
                  value={section}
                  onChange={async e => {
                    const next = e.target.value;
                    if (next === "__logout") {
                      await logout();
                      return;
                    }
                    setSection(next);
                  }}
                  style={{ ...inp, marginLeft: "auto", width: "auto", minWidth: 170, padding: "6px 10px", fontSize: 12, background: S2, border: "1px solid " + BD2 }}>
                  {NAV.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}
                  <option value="__logout">Sair</option>
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <div style={{ display: "flex" }}>
                  {NAV.map(n => (
                    <button key={n.key} onClick={() => setSection(n.key)} style={{
                      background: "transparent", border: "none",
                      color: section === n.key ? G : T2,
                      padding: "13px 18px", fontSize: 13,
                      fontFamily: "'Outfit',sans-serif", cursor: "pointer",
                      fontWeight: section === n.key ? 600 : 400,
                      borderBottom: "2px solid "+(section === n.key ? G : "transparent"),
                      whiteSpace: "nowrap", transition: "all .15s",
                    }}>{n.label}</button>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: T2 }}>{user.name}</span>
                <button style={bsm()} onClick={logout}>Sair</button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
          {section === "patrimonio" && <Patrimonio portfolios={portfolios} savePortfolios={savePortfolios} prices={prices} setPrices={setPrices} fx={fx} setFx={setFx} nwHistory={nwHistory} saveNwHistory={saveNwHistory} baseCurrency={baseCurrency} onUpdateBaseCurrency={updateBaseCurrency} />}
          {section === "ideias"     && <Ideias ideas={ideas} saveIdeas={saveIdeas} />}
          {section === "objetivos"  && <Objetivos goals={goals} saveGoals={saveGoals} onAddCalendarTask={addGoalSuggestionToCalendar} />}
          {section === "calendario" && <CalendarView slots={calendarSlots} onSaveSlots={saveCalendarSlots} newSlotPrefill={calendarSlotPrefill} onConsumeNewSlotPrefill={consumeCalendarSlotPrefill} />}
        </div>

      </div>
      )}
    </>
  );
}
