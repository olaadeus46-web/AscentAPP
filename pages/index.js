import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import CalendarView from "../components/CalendarView";
import HomeScreen from "../components/app/HomeScreen";
import PatrimonioSection from "../components/app/PatrimonioSection";
import IdeiasSection from "../components/app/IdeiasSection";
import ObjetivosSection from "../components/app/ObjetivosSection";
import FinancasSection from "../components/app/FinancasSection";
import {
  APP_FONT,
  BG,
  S2,
  BD,
  BD2,
  T,
  T2,
  G,
  bsm,
  lsSet,
  readLocalAppData,
  hasMeaningfulAppData,
  isEmptyRemoteData,
  apiGetUserData,
  apiSaveUserData,
} from "../components/app/shared";

export default function App() {
  const [section, setSection] = useState("patrimonio");
  const [isMobile, setIsMobile] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("CHF");
  const [portfolios, setPortfolios] = useState([]);
  const [prices, setPrices] = useState({});
  const [fx, setFx] = useState({ EUR: 0.94, USD: 0.89, GBP: 1.13 });
  const [nwHistory, setNwHistory] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [goals, setGoals] = useState([]);
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [financeData, setFinanceData] = useState(null);
  const [calendarSlotPrefill, setCalendarSlotPrefill] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [hasUsers, setHasUsers] = useState(true);

  const dataRef = useRef({
    portfolios: [],
    nwHistory: [],
    ideas: [],
    goals: [],
    startDate: null,
    baseCurrency: "CHF",
    calendarSlots: [],
    financeData: null,
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
      financeData: data?.financeData || null,
    };

    lsSet("portfolios", next.portfolios);
    lsSet("nw_snapshots", next.nwHistory);
    lsSet("income_ideas", next.ideas);
    lsSet("goals", next.goals);
    lsSet("calendar_slots", next.calendarSlots);
    lsSet("start_date", next.startDate);
    lsSet("base_currency", next.baseCurrency);
    lsSet("finance_data", next.financeData);

    dataRef.current = next;
    setPortfolios(next.portfolios);
    setNwHistory(next.nwHistory);
    setIdeas(next.ideas);
    setGoals(next.goals);
    setCalendarSlots(next.calendarSlots);
    setFinanceData(next.financeData);
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
          const mergedRemoteData = {
            ...remoteData,
            financeData:
              remoteData?.financeData?.transactions?.length || !localData?.financeData?.transactions?.length
                ? remoteData?.financeData
                : localData.financeData,
          };
          if (isEmptyRemoteData(remoteData) && hasMeaningfulAppData(localData)) {
            const migrated = await apiSaveUserData(localData);
            applyUserData(migrated);
          } else {
            applyUserData(mergedRemoteData);
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
    persistUserData((prev) => ({
      portfolios: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.portfolios) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveNwHistory = useCallback((valueOrUpdater) => {
    persistUserData((prev) => ({
      nwHistory: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.nwHistory) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveIdeas = useCallback((valueOrUpdater) => {
    persistUserData((prev) => ({
      ideas: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.ideas) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveGoals = useCallback((valueOrUpdater) => {
    persistUserData((prev) => ({
      goals: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.goals) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveCalendarSlots = useCallback((valueOrUpdater) => {
    persistUserData((prev) => ({
      calendarSlots: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.calendarSlots) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const saveFinanceData = useCallback((valueOrUpdater) => {
    persistUserData((prev) => ({
      financeData: typeof valueOrUpdater === "function" ? valueOrUpdater(prev.financeData) : valueOrUpdater,
    }));
  }, [persistUserData]);

  const updateBaseCurrency = useCallback((value) => {
    persistUserData({ baseCurrency: value });
  }, [persistUserData]);

  const addGoalSuggestionToCalendar = useCallback((goal, suggestion) => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const startHour = Math.min(Math.max(now.getHours() + 1, 8), 22);
    const endHour = Math.min(startHour + 1, 23);

    const catMap = {
      Financeiro: "finance",
      Hábito: "health",
      Aprendizagem: "learning",
      Projeto: "work",
      Outro: "other",
    };

    setSection("calendario");
    setCalendarSlotPrefill({
      requestId: Date.now() + Math.floor(Math.random() * 1000),
      title: suggestion?.title || `Passo para objetivo: ${goal?.title || "Objetivo"}`,
      category: catMap[goal?.category] || "other",
      status: "todo",
      date: todayIso,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
      notes: suggestion?.notes || `Tarefa criada a partir do objetivo "${goal?.title || "Objetivo"}"`,
      recurring: "none",
    });
  }, []);

  const consumeCalendarSlotPrefill = useCallback(() => {
    setCalendarSlotPrefill(null);
  }, []);

  const NAV = [
    { key: "patrimonio", label: "Patrimônio", icon: "💰" },
    { key: "financas", label: "Finanças", icon: "📊" },
    { key: "ideias", label: "Ideias", icon: "💡" },
    { key: "objetivos", label: "Objetivos", icon: "🎯" },
    { key: "calendario", label: "Calendário", icon: "📅" },
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

  if (!loaded) {
    return (
      <div style={{ fontFamily: APP_FONT, background: BG, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: T2 }}>
        <p>A carregar...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Rota ao Milhão</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Acompanha o teu patrimônio, planeia o teu tempo e desenvolve as tuas fontes de rendimento. Tudo num só lugar." />
        <meta name="theme-color" content="#07090f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ASCENT" />
        <link rel="icon" href="/ascent-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet" />
      </Head>

      {!user ? (
        <HomeScreen
          hasUsers={hasUsers}
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setHasUsers(true);
            apiGetUserData().then(applyUserData).catch(() => applyUserData({}));
          }}
        />
      ) : (
        <div style={{ fontFamily: APP_FONT, background: `radial-gradient(circle at 18% -12%, #25335a 0%, ${S2} 34%, ${BG} 78%)`, minHeight: "100dvh", color: T, paddingBottom: isMobile ? "calc(68px + env(safe-area-inset-bottom, 0px))" : "env(safe-area-inset-bottom, 0px)" }}>
          <style>{`*{box-sizing:border-box;margin:0;padding:0;}html,body{min-height:100%;background:${BG};}body{padding:0;margin:0;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}input[type=number]::-webkit-inner-spin-button{opacity:.3;}select option{background:${S2};color:${T};}button{-webkit-tap-highlight-color:transparent;}*{scrollbar-width:thin;scrollbar-color:${BD2} transparent;}::-webkit-scrollbar{height:8px;width:8px;}::-webkit-scrollbar-thumb{background:${BD2};border-radius:99px;}@media (max-width: 900px){input,select,textarea{font-size:16px !important;}}`}</style>

          <div style={{ background: "rgba(12,17,32,.72)", backdropFilter: "blur(16px)", borderBottom: "1px solid " + BD, position: "sticky", top: 0, zIndex: 50 }}>
            <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "10px 14px" : "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 58, gap: 12, flexWrap: "nowrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/apple-touch-icon.png" alt="A" style={{ width: 44, height: 44, borderRadius: 12, display: "block", flexShrink: 0 }} />
              </div>
              {isMobile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", minWidth: 0, flexShrink: 1 }}>
                  <span style={{ fontSize: 12, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{user.name}</span>
                  <button title="Sair" aria-label="Sair" style={bsm({ padding: "6px 10px", borderRadius: 999, minWidth: 34 })} onClick={logout}>logout</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                  <div style={{ display: "flex" }}>
                    {NAV.map((n) => (
                      <button title={n.label} aria-label={n.label} key={n.key} onClick={() => setSection(n.key)} style={{ background: "transparent", border: "none", color: section === n.key ? G : T2, padding: "10px 14px", fontSize: 22, lineHeight: 1, fontFamily: "'Outfit',sans-serif", cursor: "pointer", fontWeight: section === n.key ? 600 : 400, borderBottom: "2px solid " + (section === n.key ? G : "transparent"), whiteSpace: "nowrap", transition: "all .15s" }}>{n.icon}</button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: T2 }}>{user.name}</span>
                  <button title="Sair" aria-label="Sair" style={bsm()} onClick={logout}>logout</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 14px 20px" : "28px 24px" }}>
            {section === "patrimonio" && <PatrimonioSection portfolios={portfolios} savePortfolios={savePortfolios} prices={prices} setPrices={setPrices} fx={fx} setFx={setFx} nwHistory={nwHistory} saveNwHistory={saveNwHistory} baseCurrency={baseCurrency} onUpdateBaseCurrency={updateBaseCurrency} financeData={financeData} />}
            {section === "financas" && <FinancasSection portfolios={portfolios} financeData={financeData} saveFinanceData={saveFinanceData} baseCurrency={baseCurrency} onUpdateBaseCurrency={updateBaseCurrency} fx={fx} />}
            {section === "ideias" && <IdeiasSection ideas={ideas} saveIdeas={saveIdeas} />}
            {section === "objetivos" && <ObjetivosSection goals={goals} saveGoals={saveGoals} onAddCalendarTask={addGoalSuggestionToCalendar} />}
            {section === "calendario" && <CalendarView slots={calendarSlots} onSaveSlots={saveCalendarSlots} newSlotPrefill={calendarSlotPrefill} onConsumeNewSlotPrefill={consumeCalendarSlotPrefill} />}
          </div>

          {isMobile && (
            <div style={{ position: "fixed", left: 10, right: 10, bottom: "calc(8px + env(safe-area-inset-bottom, 0px))", zIndex: 70, background: "rgba(12,17,32,.82)", border: "1px solid " + BD, borderRadius: 18, backdropFilter: "blur(14px)", boxShadow: "0 16px 34px rgba(4,8,22,.45)", padding: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                {NAV.map((n) => (
                  <button title={n.label} aria-label={n.label} key={n.key} onClick={() => setSection(n.key)} style={{ ...bsm({ padding: "8px 6px", borderRadius: 12, border: "1px solid " + (section === n.key ? G + "50" : "transparent"), background: section === n.key ? G + "22" : "transparent", color: section === n.key ? G : T2, fontWeight: section === n.key ? 600 : 500 }), fontSize: 20, lineHeight: 1 }}>{n.icon}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
