import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TARGET,
  G,
  S1,
  S2,
  S3,
  BD,
  BD2,
  T,
  T2,
  T3,
  GR,
  RD,
  BL,
  MILESTONES,
  PORTFOLIO_TYPES,
  ASSET_TYPES,
  CURRENCIES,
  PALETTE,
  ETF_PICKS,
  fmtN,
  fmtF,
  fmtD,
  fmtDs,
  apiSearch,
  apiBatchQuotes,
  apiSingleQuote,
  apiFxRates,
  toChf,
  toBaseCurrency,
  assetValChf,
  assetCostChf,
  pfValChf,
  totalNW,
  inferType,
  guessCurrency,
  card,
  btn,
  btnG,
  bsm,
  inp,
  lbl,
  ProgressBar,
  Modal,
  NwChart,
} from "./shared";
import { getMonthlyAccountBalances } from "../../lib/finance";

const PATRIMONIO_SECTIONS = [
  { key: "overview", label: "Resumo" },
  { key: "portfolios", label: "Carteiras" },
  { key: "milestones", label: "Marcos" },
];

function AddAssetModal({ onClose, onSave }) {
  const TABS = ["Pesquisar", "Ticker Manual", "Fiat / Dinheiro"];
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [noRes, setNoRes] = useState(false);
  const [manTicker, setManTicker] = useState("");
  const [validating, setValidating] = useState(false);
  const [valErr, setValErr] = useState("");
  const [step, setStep] = useState("pick");
  const [livePrice, setLivePrice] = useState(null);
  const [form, setForm] = useState({
    name: "",
    ticker: "",
    type: "etf",
    currency: "EUR",
    quantity: "",
    buyPrice: "",
    buyDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const timer = useRef(null);
  const qRef = useRef(null);
  const mRef = useRef(null);

  useEffect(() => {
    if (tab === 0) setTimeout(() => qRef.current?.focus(), 80);
    if (tab === 1) setTimeout(() => mRef.current?.focus(), 80);
    if (tab === 2) goToForm({ name: "", ticker: "", type: "fiat", currency: "CHF" });
  }, [tab]);

  useEffect(() => {
    clearTimeout(timer.current);
    setNoRes(false);
    setResults([]);
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
    setForm((f) => ({ ...f, ...preset }));
    setStep("form");
    if (preset.ticker) {
      setValidating(true);
      const q = await apiSingleQuote(preset.ticker);
      if (q) {
        setLivePrice(q);
        setForm((f) => ({ ...f, currency: q.currency || f.currency, name: f.name || q.name || preset.ticker }));
      }
      setValidating(false);
    }
  };

  const pickResult = (res) => {
    const type = inferType(res.type, res.symbol, res.name);
    const cur = res.currency || guessCurrency(res.symbol);
    goToForm({ ticker: res.symbol, name: res.name, type, currency: cur });
    setQuery("");
    setResults([]);
  };

  const validateManual = async () => {
    const t = manTicker.trim().toUpperCase();
    if (!t) return;
    setValidating(true);
    setValErr("");
    const q = await apiSingleQuote(t);
    if (!q) {
      setValErr(`"${t}" não encontrado. Verifica o ticker — ex: SXR8.DE, VWCE.DE, AAPL, BTC-USD`);
      setValidating(false);
      return;
    }
    setLivePrice(q);
    setForm((f) => ({ ...f, ticker: t, name: q.name || t, type: inferType("", t, ""), currency: q.currency || guessCurrency(t) }));
    setStep("form");
    setValidating(false);
  };

  const save = () => {
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return;
    if (form.type === "fiat" && !form.name.trim()) return;
    onSave({ ...form, id: Date.now(), quantity: qty, buyPrice: parseFloat(form.buyPrice) || 0, ticker: form.type === "fiat" ? null : form.ticker });
  };

  const isFiat = form.type === "fiat";
  const typeColor = ASSET_TYPES.find((a) => a.key === form.type)?.color || T2;
  const typeLabel = ASSET_TYPES.find((a) => a.key === form.type)?.label || "";
  const canSave = parseFloat(form.quantity) > 0 && (isFiat ? form.name.trim() : form.ticker);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S1, border: "1px solid " + BD2, borderRadius: 18, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid " + BD }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T }}>Adicionar Ativo</span>
            <button onClick={onClose} style={bsm()}>×</button>
          </div>
          {step === "pick" && (
            <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
              {TABS.map((label, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ ...bsm({ fontSize: 13, padding: "9px 16px", marginRight: 2, fontWeight: tab === i ? 600 : 400 }), borderRadius: "8px 8px 0 0", border: "1px solid " + (tab === i ? BD2 : BD), borderBottom: "1px solid " + (tab === i ? S1 : BD), background: tab === i ? S1 : S2, color: tab === i ? T : T2 }}>{label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: step === "pick" && tab === 0 ? 420 : undefined }}>
          {step === "pick" && tab === 0 && (
            <>
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T3, fontSize: 16, pointerEvents: "none" }}>{searching ? "⟳" : "⌕"}</span>
                  <input ref={qRef} style={{ ...inp, paddingLeft: 34, fontSize: 14 }} placeholder="Pesquisar: SXR8, Vanguard, Apple, Bitcoin..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>

                {(results.length > 0 || noRes) && (
                  <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, background: S2, border: "1px solid " + BD2, borderRadius: 10, zIndex: 40, overflow: "hidden", boxShadow: "0 10px 36px rgba(0,0,0,.55)" }}>
                    {noRes && (
                      <div style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 13, color: T2, marginBottom: 6 }}>Sem resultados para "{query}"</p>
                        <p style={{ fontSize: 12, color: T3 }}>
                          Tenta o <span style={{ color: G, cursor: "pointer", fontWeight: 600 }} onClick={() => { setTab(1); setManTicker(query.toUpperCase()); }}>Ticker Manual</span> com o símbolo exacto (ex: SXR8.DE)
                        </p>
                      </div>
                    )}
                    {results.map((res, i) => {
                      const it = inferType(res.type, res.symbol, res.name);
                      const ic = ASSET_TYPES.find((a) => a.key === it)?.color || T2;
                      return (
                        <div key={i} onClick={() => pickResult(res)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid " + BD : "none", transition: "background .1s" }} onMouseEnter={(e) => (e.currentTarget.style.background = S3)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T, fontFamily: "monospace" }}>{res.symbol}</span>
                              <span style={{ fontSize: 10, color: ic, background: ic + "18", padding: "2px 7px", borderRadius: 20, fontWeight: 600 }}>{ASSET_TYPES.find((a) => a.key === it)?.label}</span>
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
                  <p style={{ fontSize: 11, color: T3, marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>ETFs europeus populares</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ETF_PICKS.map((item) => (
                      <button key={item.sym} onClick={() => goToForm({ ticker: item.sym, name: item.name, type: "etf", currency: item.cur })} style={{ ...bsm({ fontSize: 12, padding: "7px 13px", color: G, borderColor: G + "30" }) }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{item.sym}</span>
                        <span style={{ color: T3, marginLeft: 6, fontSize: 11 }}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "pick" && tab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={lbl}>Ticker Yahoo Finance *</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={mRef} style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: 15, letterSpacing: 0.5, borderColor: valErr ? RD : BD2 }} placeholder="SXR8.DE   VWCE.DE   AAPL   NOVN.SW   BTC-USD" value={manTicker} onChange={(e) => { setManTicker(e.target.value.toUpperCase()); setValErr(""); }} onKeyDown={(e) => e.key === "Enter" && validateManual()} />
                  <button onClick={validateManual} disabled={validating || !manTicker.trim()} style={{ ...bsm({ padding: "10px 18px", color: G, borderColor: G + "40" }), opacity: manTicker.trim() ? 1 : 0.4 }}>{validating ? "⟳" : "Validar"}</button>
                </div>
                {valErr && <p style={{ fontSize: 12, color: RD, marginTop: 6 }}>{valErr}</p>}
                {!valErr && <p style={{ fontSize: 11, color: T3, marginTop: 6, lineHeight: 1.6 }}>Xetra: SXR8.DE, VWCE.DE | SIX: NOVN.SW | LSE: CSPX.L | US: AAPL, MSFT | Cripto: BTC-USD</p>}
              </div>
              <div>
                <p style={{ fontSize: 11, color: T3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>ETFs rápidos</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ETF_PICKS.map((item) => (
                    <button key={item.sym} onClick={() => { setManTicker(item.sym); setValErr(""); }} style={{ ...bsm({ fontSize: 11, padding: "5px 10px" }), color: manTicker === item.sym ? G : T2, borderColor: manTicker === item.sym ? G + "60" : BD2, background: manTicker === item.sym ? G + "12" : "transparent" }}>{item.sym}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "form" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: typeColor + "0d", border: "1.5px solid " + typeColor + "35", borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isFiat ? (
                    <p style={{ fontSize: 14, fontWeight: 600, color: T }}>Dinheiro / Fiat</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T, fontFamily: "monospace", letterSpacing: 0.5 }}>{form.ticker}</p>
                      <p style={{ fontSize: 12, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.name}</p>
                    </>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: typeColor, background: typeColor + "18", padding: "3px 9px", borderRadius: 20, fontWeight: 600, display: "block", marginBottom: 4 }}>{typeLabel}</span>
                  {validating && <span style={{ fontSize: 11, color: T3 }}>a buscar preço...</span>}
                  {livePrice && !validating && (
                    <div>
                      <span style={{ fontSize: 14, color: G, fontWeight: 700 }}>{fmtF(livePrice.price)} {livePrice.currency}</span>
                      <span style={{ fontSize: 11, color: livePrice.changePct >= 0 ? GR : RD, display: "block" }}>{livePrice.changePct >= 0 ? "+" : ""}{(livePrice.changePct || 0).toFixed(2)}% hoje</span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setStep("pick"); setLivePrice(null); setForm((f) => ({ ...f, name: "", ticker: "", type: "etf" })); }} style={bsm({ padding: "4px 8px", fontSize: 12, color: T3 })}>×</button>
              </div>

              {!isFiat && (
                <div>
                  <span style={lbl}>Tipo</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ASSET_TYPES.filter((a) => a.key !== "fiat").map((a) => (
                      <button key={a.key} onClick={() => setForm((f) => ({ ...f, type: a.key }))} style={{ ...bsm({ fontSize: 12, padding: "6px 12px" }), background: form.type === a.key ? a.color : "transparent", color: form.type === a.key ? "#111" : T2, border: "1px solid " + (form.type === a.key ? a.color : BD2) }}>{a.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {isFiat && (
                <div>
                  <span style={lbl}>Nome da conta *</span>
                  <input style={inp} placeholder="ex: UBS Conta Corrente" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={lbl}>Quantidade *</span>
                  <input style={inp} type="number" step="any" placeholder={isFiat ? "ex: 15000" : "ex: 10"} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <span style={lbl}>Moeda</span>
                  <select style={inp} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {!isFiat && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <span style={lbl}>Preço de compra</span>
                    <input style={inp} type="number" step="any" placeholder={livePrice ? "Atual: " + fmtF(livePrice.price) : "ex: 540.00"} value={form.buyPrice} onChange={(e) => setForm((f) => ({ ...f, buyPrice: e.target.value }))} />
                  </div>
                  <div>
                    <span style={lbl}>Data de compra</span>
                    <input style={inp} type="date" value={form.buyDate} onChange={(e) => setForm((f) => ({ ...f, buyDate: e.target.value }))} />
                  </div>
                </div>
              )}

              <div>
                <span style={lbl}>Notas (opcional)</span>
                <input style={inp} placeholder="ex: DCA mensal, lump sum..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button style={{ ...btn({ flex: 1 }) }} onClick={onClose}>Cancelar</button>
                <button style={{ ...btnG, flex: 1, opacity: canSave ? 1 : 0.4, cursor: canSave ? "pointer" : "not-allowed" }} onClick={canSave ? save : undefined}>Adicionar Ativo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioCard({ pf, prices, fx, loading, onAddAsset, onDeleteAsset, onSwapAsset, onDelete, baseCurrency, monthlyBalanceChf = 0, financeMonthLabel = "" }) {
  const [open, setOpen] = useState(true);
  const [swapAssetId, setSwapAssetId] = useState(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapResults, setSwapResults] = useState([]);
  const [swapSearching, setSwapSearching] = useState(false);
  const [swapNoRes, setSwapNoRes] = useState(false);
  const swapTimer = useRef(null);
  const pt = PORTFOLIO_TYPES.find((t) => t.key === pf.type) || PORTFOLIO_TYPES[5];
  const color = pf.color || G;
  const totalChf = pfValChf(pf, prices, fx);
  const total = toBaseCurrency(totalChf, baseCurrency, fx);
  const costChf = pf.assets.reduce((s, a) => s + assetCostChf(a, fx), 0);
  const cost = toBaseCurrency(costChf, baseCurrency, fx);
  const pnl = total - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  useEffect(() => {
    clearTimeout(swapTimer.current);
    setSwapNoRes(false);

    if (swapAssetId === null || swapQuery.trim().length < 2) {
      setSwapResults([]);
      return;
    }

    swapTimer.current = setTimeout(async () => {
      setSwapSearching(true);
      const res = await apiSearch(swapQuery.trim());
      setSwapResults(res || []);
      setSwapNoRes((res || []).length === 0);
      setSwapSearching(false);
    }, 350);

    return () => clearTimeout(swapTimer.current);
  }, [swapQuery, swapAssetId]);

  const chooseSwapAsset = (asset, result) => {
    const type = inferType(result.type, result.symbol, result.name);
    const currency = result.currency || guessCurrency(result.symbol);
    onSwapAsset(pf.id, asset.id, {
      name: result.name || asset.name,
      ticker: result.symbol || asset.ticker,
      type,
      currency,
    });
    setSwapAssetId(null);
    setSwapQuery("");
    setSwapResults([]);
    setSwapNoRes(false);
  };

  return (
    <div style={{ ...card({ padding: 0, overflow: "hidden" }), borderTop: "3px solid " + color }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: T }}>{pf.name}</span>
            <span style={{ fontSize: 10, color, background: color + "18", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{pt.label}</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 3, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: G, fontWeight: 600 }}>{baseCurrency} {fmtF(total)}</span>
            {cost > 0 && <span style={{ fontSize: 12, color: pnl >= 0 ? GR : RD }}>{pnl >= 0 ? "+" : ""}{baseCurrency} {fmtF(Math.abs(pnl))} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>}
            {monthlyBalanceChf !== 0 && <span style={{ fontSize: 11, color: monthlyBalanceChf >= 0 ? BL : RD }}>{financeMonthLabel} {monthlyBalanceChf >= 0 ? "+" : "-"}CHF {fmtF(Math.abs(monthlyBalanceChf))}</span>}
          </div>
        </div>
        <span style={{ fontSize: 13, color: T3, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid " + BD }}>
          {pf.assets.length === 0 ? (
            <p style={{ color: T3, fontSize: 13, padding: "22px", textAlign: "center" }}>Sem ativos. Adiciona um abaixo.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid " + BD }}>
                    {["Ativo", "Qtd", "Compra", "Preço Atual", "Valor CHF", "P&L", ""].map((h) => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: T2, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pf.assets.map((asset) => {
                    const p = asset.ticker ? prices[asset.ticker.toUpperCase()] : null;
                    const val = assetValChf(asset, prices, fx);
                    const cost2 = assetCostChf(asset, fx);
                    const pl = val !== null ? val - cost2 : null;
                    const plPct = cost2 > 0 && pl !== null ? (pl / cost2) * 100 : null;
                    const isLoad = loading.has(asset.ticker?.toUpperCase());
                    const at = ASSET_TYPES.find((a) => a.key === asset.type);
                    const isFinanceAdjustment = Boolean(asset.isFinanceAdjustment);
                    return (
                      <Fragment key={asset.id}>
                        <tr style={{ borderBottom: "1px solid " + BD }}>
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ fontWeight: 500, color: T }}>{asset.name || asset.ticker || "–"}</div>
                            {asset.ticker && <div style={{ fontSize: 11, color: G, fontFamily: "monospace" }}>{asset.ticker}</div>}
                            <div style={{ fontSize: 10, color: T3 }}>{at?.label} · {asset.currency}{isFinanceAdjustment ? " · ajuste automático" : ""}</div>
                          </td>
                          <td style={{ padding: "12px 12px", color: T2, fontFamily: "monospace", fontSize: 12 }}>{(asset.quantity || 0).toLocaleString("de-CH", { maximumFractionDigits: 8 })}</td>
                          <td style={{ padding: "12px 12px" }}>
                            {asset.buyPrice > 0 ? (
                              <>
                                <div style={{ color: T2 }}>{asset.currency} {fmtF(asset.buyPrice)}</div>
                                {asset.buyDate && <div style={{ fontSize: 10, color: T3 }}>{fmtD(asset.buyDate)}</div>}
                              </>
                            ) : (
                              <span style={{ color: T3 }}>–</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {asset.type === "fiat" ? (
                              <span style={{ color: T3 }}>–</span>
                            ) : isLoad ? (
                              <span style={{ color: T3, fontSize: 12 }}>...</span>
                            ) : p ? (
                              <div>
                                <div style={{ color: T }}>{asset.currency} {fmtF(p.price)}</div>
                                <div style={{ fontSize: 11, color: p.changePct >= 0 ? GR : RD }}>{p.changePct >= 0 ? "+" : ""}{(p.changePct || 0).toFixed(2)}%</div>
                              </div>
                            ) : (
                              <span style={{ color: T3 }}>N/D</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 12px" }}><span style={{ color: G, fontWeight: 500 }}>{val !== null ? "CHF " + fmtF(val) : "–"}</span></td>
                          <td style={{ padding: "12px 12px" }}>
                            {pl !== null ? (
                              <div>
                                <div style={{ color: pl >= 0 ? GR : RD, fontWeight: 500 }}>{pl >= 0 ? "+" : ""}CHF {fmtF(Math.abs(pl))}</div>
                                {plPct !== null && <div style={{ fontSize: 11, color: pl >= 0 ? GR : RD }}>{plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%</div>}
                              </div>
                            ) : (
                              <span style={{ color: T3 }}>–</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            {isFinanceAdjustment ? null : (
                              <div style={{ display: "flex", gap: 6 }}>
                                {asset.type !== "fiat" && <button onClick={() => { setSwapAssetId(asset.id); setSwapQuery(""); setSwapResults([]); setSwapNoRes(false); }} style={bsm({ color: BL, borderColor: BL + "25", padding: "3px 8px" })}>Trocar</button>}
                                <button onClick={() => onDeleteAsset(pf.id, asset.id)} style={bsm({ color: RD, borderColor: RD + "25", padding: "3px 8px" })}>×</button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {swapAssetId === asset.id && asset.type !== "fiat" && (
                          <tr style={{ borderBottom: "1px solid " + BD }}>
                            <td colSpan={7} style={{ padding: "10px 12px", position: "relative" }}>
                              <input style={{ ...inp, fontSize: 12, padding: "8px 10px" }} placeholder="Pesquisar novo ativo (ticker/nome)..." value={swapQuery} onChange={(e) => setSwapQuery(e.target.value)} />
                              {(swapResults.length > 0 || swapNoRes) && (
                                <div style={{ marginTop: 6, background: S2, border: "1px solid " + BD2, borderRadius: 8, overflow: "hidden" }}>
                                  {swapNoRes && <p style={{ color: T3, fontSize: 11, padding: "8px 10px" }}>{swapSearching ? "a procurar..." : "Sem resultados"}</p>}
                                  {swapResults.map((res, index) => (
                                    <div key={index} onClick={() => chooseSwapAsset(asset, res)} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: index < swapResults.length - 1 ? "1px solid " + BD : "none" }}>
                                      <span style={{ color: T, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{res.symbol}</span>
                                      <span style={{ color: T2, fontSize: 11, marginLeft: 8 }}>{res.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <button onClick={() => { setSwapAssetId(null); setSwapQuery(""); setSwapResults([]); setSwapNoRes(false); }} style={bsm({ color: T2, borderColor: BD2, padding: "3px 8px" })}>Fechar</button>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "12px 20px", borderTop: "1px solid " + BD, display: "flex", gap: 8 }}>
            <button style={bsm({ color: G, borderColor: G + "30" })} onClick={() => onAddAsset(pf.id)}>+ Ativo</button>
            <button style={bsm({ color: RD, borderColor: RD + "20", marginLeft: "auto" })} onClick={() => onDelete(pf.id)}>Remover Carteira</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Marcos({ portfolios, prices, fx, baseCurrency, embedded = false }) {
  const nwChf = totalNW(portfolios, prices, fx);
  const nw = toBaseCurrency(nwChf, baseCurrency, fx);

  return (
    <div style={{ paddingBottom: embedded ? 0 : 40 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T, marginBottom: 8 }}>Marcos da Jornada</h2>
      <p style={{ color: T2, fontSize: 14, marginBottom: 24 }}>Os teus pontos de chegada no caminho para o milhão.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {MILESTONES.map((m, i) => {
          const done = nw >= m.amount;
          const active = !done && (i === 0 || nw >= MILESTONES[i - 1].amount);
          const pct = Math.min((nw / m.amount) * 100, 100);
          return (
            <div key={m.amount} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? G : active ? G + "25" : S3, border: "2px solid " + (done ? "#ffe39e" : active ? G : BD2), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: done ? "#1a1205" : active ? G : T3, fontWeight: 700, zIndex: 1, flexShrink: 0 }}>
                  {done ? "✓" : i + 1}
                </div>
                {i < MILESTONES.length - 1 && <div style={{ width: 2, flex: 1, background: done ? G + "40" : BD, margin: "4px 0" }} />}
              </div>
              <div style={{ ...card({ flex: 1, marginBottom: i < MILESTONES.length - 1 ? 8 : 0, borderColor: done ? G + "40" : active ? G + "20" : BD, background: done ? G + "08" : active ? G + "03" : S1 }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: done ? G : active ? T : T2, marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 13, color: T2 }}>{baseCurrency} {fmtN(toBaseCurrency(m.amount, baseCurrency, fx))}</p>
                  </div>
                  {done ? (
                    <span style={{ fontSize: 11, color: G, background: G + "18", padding: "4px 12px", borderRadius: 20 }}>ALCANÇADO</span>
                  ) : active ? (
                    <span style={{ fontSize: 11, color: G, background: G + "10", padding: "4px 12px", borderRadius: 20, border: "1px solid " + G + "30" }}>EM CURSO</span>
                  ) : null}
                </div>
                {!done && (
                  <div style={{ marginTop: 10 }}>
                    <ProgressBar value={nw} max={m.amount} color={active ? G : T3} height={4} />
                    <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>Faltam {baseCurrency} {fmtN(toBaseCurrency(m.amount, baseCurrency, fx) - nw)} ({pct.toFixed(1)}%)</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PatrimonioSection({ portfolios, savePortfolios, prices, setPrices, fx, setFx, nwHistory, saveNwHistory, baseCurrency, onUpdateBaseCurrency, financeData }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRef, setLastRef] = useState(null);
  const [showAddPF, setShowAddPF] = useState(false);
  const [addFor, setAddFor] = useState(null);
  const [pfForm, setPfForm] = useState({ name: "", type: "bank", color: PALETTE[0] });
  const financeMonth = new Date().toISOString().slice(0, 7);

  const monthlyAccountBalances = useMemo(() => getMonthlyAccountBalances(financeData, financeMonth), [financeData, financeMonth]);
  const totalMonthlyBalanceChf = useMemo(() => Object.values(monthlyAccountBalances).reduce((sum, value) => sum + value, 0), [monthlyAccountBalances]);
  const financeMonthLabel = useMemo(() => {
    const [year, month] = financeMonth.split("-");
    return `${month}/${year}`;
  }, [financeMonth]);

  const visiblePortfolios = useMemo(() => {
    return portfolios.map((portfolio) => {
      const monthlyBalanceChf = monthlyAccountBalances[String(portfolio.id)] || 0;
      if (!monthlyBalanceChf) return portfolio;

      const fiatIndex = portfolio.assets.findIndex((asset) => asset.type === "fiat" && asset.currency === "CHF");
      if (fiatIndex >= 0) {
        return {
          ...portfolio,
          assets: portfolio.assets.map((asset, index) => {
            if (index !== fiatIndex) return asset;
            return {
              ...asset,
              quantity: Number(asset.quantity || 0) + monthlyBalanceChf,
            };
          }),
        };
      }

      return {
        ...portfolio,
        assets: [
          {
            id: `finance-adjustment-${portfolio.id}-${financeMonth}`,
            name: `Saldo mensal ${financeMonthLabel}`,
            ticker: null,
            type: "fiat",
            currency: "CHF",
            quantity: monthlyBalanceChf,
            buyPrice: 0,
            buyDate: "",
            notes: "Ajuste automático vindo da aba Finanças.",
            isFinanceAdjustment: true,
          },
          ...portfolio.assets,
        ],
      };
    });
  }, [portfolios, monthlyAccountBalances, financeMonth, financeMonthLabel]);

  const allTickers = useMemo(() => {
    const s = new Set();
    portfolios.forEach((p) => p.assets.forEach((a) => { if (a.ticker && a.type !== "fiat") s.add(a.ticker.toUpperCase()); }));
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
      const norm = {};
      for (const [k, v] of Object.entries(batch)) norm[k.toUpperCase()] = v;
      setPrices((prev) => ({ ...prev, ...norm }));
      setLoading(new Set());
    }

    setLastRef(new Date());

    const nw = portfolios.reduce(
      (s, p) =>
        s +
        p.assets.reduce((as, a) => {
          if (a.type === "fiat") return as + (toChf(a.quantity, a.currency, newFx) ?? a.quantity);
          if (!a.ticker) return as;
          const p2 = prices[a.ticker.toUpperCase()];
          if (!p2) return as;
          return as + (toChf(a.quantity * p2.price, a.currency, newFx) ?? 0);
        }, 0),
      0,
    ) + totalMonthlyBalanceChf;

    if (nw > 0) {
      const today = new Date().toISOString().slice(0, 10);
      saveNwHistory((prev) => [...prev.filter((e) => e.date !== today), { date: today, value: Math.round(nw) }].sort((a, b) => a.date.localeCompare(b.date)));
    }

    setRefreshing(false);
  }, [allTickers, portfolios, prices, refreshing, saveNwHistory, setFx, setPrices, totalMonthlyBalanceChf]);

  useEffect(() => {
    if (allTickers.length > 0) refreshPrices();
  }, []);

  const totalChf = useMemo(() => totalNW(visiblePortfolios, prices, fx), [visiblePortfolios, prices, fx]);
  const total = toBaseCurrency(totalChf, baseCurrency, fx);
  const totalCostChf = useMemo(() => portfolios.reduce((s, p) => s + p.assets.reduce((as, a) => as + assetCostChf(a, fx), 0), 0), [portfolios, fx]);
  const totalCost = toBaseCurrency(totalCostChf, baseCurrency, fx);
  const pnl = total - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  const chartData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hist = nwHistory.filter((e) => e.date !== today);
    const all = total > 0 ? [...hist, { date: today, value: Math.round(total) }] : hist;
    return all.map((e) => ({ label: fmtDs(e.date), value: toBaseCurrency(e.value, baseCurrency, fx) }));
  }, [nwHistory, total, baseCurrency, fx]);

  const savePf = (upd) => {
    savePortfolios(upd);
  };

  const addPortfolio = () => {
    if (!pfForm.name.trim()) return;
    savePf([...portfolios, { ...pfForm, id: Date.now(), assets: [] }]);
    setShowAddPF(false);
    setPfForm({ name: "", type: "bank", color: PALETTE[0] });
  };

  const deletePortfolio = (id) => savePf(portfolios.filter((p) => p.id !== id));

  const onSaveAsset = (asset) => {
    const upd = portfolios.map((p) => (p.id === addFor ? { ...p, assets: [...p.assets, asset] } : p));
    savePf(upd);
    setAddFor(null);
    if (asset.ticker && asset.type !== "fiat") {
      setTimeout(async () => {
        const q = await apiSingleQuote(asset.ticker);
        if (q) setPrices((prev) => ({ ...prev, [asset.ticker.toUpperCase()]: q }));
      }, 300);
    }
  };

  const deleteAsset = (pid, aid) => savePf(portfolios.map((p) => (p.id === pid ? { ...p, assets: p.assets.filter((a) => a.id !== aid) } : p)));

  const swapAsset = (pid, aid, patch) => {
    savePf(portfolios.map((p) => (
      p.id === pid
        ? { ...p, assets: p.assets.map((a) => (a.id === aid ? { ...a, ...patch } : a)) }
        : p
    )));

    if (patch?.ticker && patch?.type !== "fiat") {
      setTimeout(async () => {
        const q = await apiSingleQuote(patch.ticker);
        if (q) setPrices((prev) => ({ ...prev, [String(patch.ticker).toUpperCase()]: q }));
      }, 250);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Patrimônio</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={baseCurrency} onChange={(e) => onUpdateBaseCurrency(e.target.value)} style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 12, background: S2, border: "1px solid " + BD2 }}>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <button style={bsm({ color: BL, borderColor: BL + "30", opacity: refreshing ? 0.6 : 1 })} onClick={refreshPrices} disabled={refreshing} title="Atualizar preços" aria-label="Atualizar preços">{refreshing ? "⟳" : "↻"}</button>
          <button style={btnG} onClick={() => setShowAddPF(true)}>+ Carteira</button>
        </div>
      </div>

      <div style={{ ...card({ marginBottom: 16, padding: "12px" }) }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
          {PATRIMONIO_SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              style={{
                ...bsm({ padding: "8px 10px", fontSize: 12 }),
                background: activeSection === section.key ? G + "18" : "transparent",
                color: activeSection === section.key ? G : T3,
                border: "1px solid " + (activeSection === section.key ? G + "45" : "transparent"),
                borderRadius: 10,
                fontWeight: activeSection === section.key ? 700 : 500,
                whiteSpace: "nowrap",
                width: "100%",
              }}>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Patrimônio", val: baseCurrency + " " + fmtF(total), sub: ((total / toBaseCurrency(TARGET, baseCurrency, fx)) * 100).toFixed(2) + "% meta", color: G },
              { label: "Investido", val: baseCurrency + " " + fmtF(totalCost), sub: "custo total" },
              { label: "P&L", val: (pnl >= 0 ? "+" : "") + baseCurrency + " " + fmtF(Math.abs(pnl)), sub: (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(1) + "%", color: pnl >= 0 ? GR : RD },
            ].map((s) => (
              <div key={s.label} style={{ ...card({ padding: "16px 18px" }), borderColor: s.color ? s.color + "35" : BD }}>
                <p style={{ fontSize: 11, color: T2, marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 16, color: s.color || T, fontWeight: 600, lineHeight: 1.2 }}>{s.val}</p>
                <p style={{ fontSize: 11, color: T3, marginTop: 5 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ ...card({ padding: "16px 18px", marginBottom: 20 }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: T2 }}>Progresso</span>
              <span style={{ fontSize: 13, color: G, fontWeight: 600 }}>{((total / TARGET) * 100).toFixed(2)}%</span>
            </div>
            <ProgressBar value={total} max={TARGET} height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {lastRef && <p style={{ fontSize: 11, color: T3 }}>Atualizado: {lastRef.toLocaleTimeString("pt-PT")}</p>}
              <p style={{ fontSize: 11, color: T3 }}>EUR/CHF {(fx.EUR || 0).toFixed(4)} · USD/CHF {(fx.USD || 0).toFixed(4)} · GBP/CHF {(fx.GBP || 0).toFixed(4)}</p>
            </div>
          </div>

          <div style={{ ...card({ marginBottom: 20, padding: "20px 18px 8px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: T2, fontWeight: 600, letterSpacing: 1 }}>EVOLUÇÃO</p>
              <span style={{ fontSize: 11, color: T3 }}>{chartData.length} ponto{chartData.length === 1 ? "" : "s"}</span>
            </div>
            <NwChart data={chartData} baseCurrency={baseCurrency} />
          </div>
        </>
      )}

      {activeSection === "portfolios" && (
        portfolios.length === 0 ? (
          <div style={{ ...card({ padding: "50px 20px", textAlign: "center" }) }}>
            <p style={{ color: T2, fontSize: 15, marginBottom: 8 }}>Nenhuma carteira ainda</p>
            <p style={{ color: T3, fontSize: 13, marginBottom: 20 }}>Adiciona o teu banco, corretora ou exchange.</p>
            <button style={btnG} onClick={() => setShowAddPF(true)}>+ Adicionar Carteira</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visiblePortfolios.map((p) => (
              <PortfolioCard key={p.id} pf={p} prices={prices} fx={fx} loading={loading} onAddAsset={(id) => setAddFor(id)} onDeleteAsset={deleteAsset} onSwapAsset={swapAsset} onDelete={deletePortfolio} baseCurrency={baseCurrency} monthlyBalanceChf={monthlyAccountBalances[String(p.id)] || 0} financeMonthLabel={financeMonthLabel} />
            ))}
          </div>
        )
      )}

      {activeSection === "milestones" && (
        <div style={{ marginTop: 6 }}>
          <Marcos portfolios={visiblePortfolios} prices={prices} fx={fx} baseCurrency={baseCurrency} embedded />
        </div>
      )}

      {showAddPF && (
        <Modal title="Nova Carteira" onClose={() => setShowAddPF(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={lbl}>Nome *</span>
              <input style={inp} placeholder="ex: UBS, Interactive Brokers, Binance" value={pfForm.name} onChange={(e) => setPfForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <span style={lbl}>Tipo</span>
              <select style={inp} value={pfForm.type} onChange={(e) => setPfForm((f) => ({ ...f, type: e.target.value }))}>
                {PORTFOLIO_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Cor</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {PALETTE.map((c) => (
                  <div key={c} onClick={() => setPfForm((f) => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: "3px solid " + (pfForm.color === c ? T : "transparent"), boxSizing: "border-box" }} />
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
