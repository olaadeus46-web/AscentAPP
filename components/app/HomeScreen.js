import { useState, useEffect } from "react";
import {
  APP_FONT,
  BG,
  S1,
  S2,
  T,
  T2,
  T3,
  G,
  BL,
  RD,
  BD,
  card,
  bsm,
  btnG,
  inp,
  lbl,
  apiAuthRequest,
} from "./shared";

export default function HomeScreen({ hasUsers, onAuthenticated }) {
  const highlights = [
    {
      title: "Patrimônio num só painel",
      text: "Concentra contas, investimentos e evolução do teu capital num espaço simples de acompanhar.",
    },
    {
      title: "Tempo com intenção",
      text: "Organiza blocos no calendário para transformar objetivos financeiros em ações consistentes.",
    },
    {
      title: "Rendimento em construção",
      text: "Explora ideias, acompanha progresso e desenvolve novas fontes de rendimento com clareza.",
    },
  ];

  const sections = [
    "Visão global do patrimônio e da rota até ao teu objetivo.",
    "Planeamento semanal com foco no que realmente move resultados.",
    "Gestão de ideias, metas e próximos passos no mesmo fluxo.",
  ];

  const [mode, setMode] = useState(hasUsers ? "login" : "register");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    setMode(hasUsers ? "login" : "register");
  }, [hasUsers]);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth <= 820);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    <div style={{ minHeight: "100dvh", background: `radial-gradient(circle at 15% -10%, #25335a 0%, ${S2} 32%, ${BG} 75%)`, color: T, padding: isPhone ? "max(12px, env(safe-area-inset-top, 0px)) 12px max(16px, env(safe-area-inset-bottom, 0px))" : "max(24px, env(safe-area-inset-top, 0px)) 18px max(28px, env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ ...card({ padding: isPhone ? "18px 14px" : "34px 28px", background: `linear-gradient(145deg, rgba(255,255,255,.06) 0%, ${S1} 45%, ${S2} 100%)`, marginBottom: 22, overflow: "hidden", position: "relative", border: "1px solid rgba(216,229,255,.18)", boxShadow: "0 30px 70px rgba(6,10,24,.45)" }) }}>
          <div style={{ position: "absolute", top: -80, right: -60, width: 260, height: 260, borderRadius: "50%", background: `${BL}22`, filter: "blur(10px)" }} />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: isPhone ? "1fr" : "minmax(0,1.15fr) minmax(300px,.85fr)", gap: isPhone ? 14 : 24, alignItems: "stretch" }}>
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.8, color: G, fontWeight: 700, marginBottom: isPhone ? 10 : 16 }}>Rota ao Milhão</p>
              <h1 style={{ fontFamily: APP_FONT, fontWeight: 700, fontSize: isPhone ? "clamp(26px, 9vw, 36px)" : "clamp(30px, 8vw, 58px)", lineHeight: 1.04, marginBottom: isPhone ? 10 : 18, maxWidth: 680 }}>Acompanha o teu patrimônio, planeia o teu tempo, desenvolve as tuas fontes de rendimento.</h1>
              <p style={{ fontSize: isPhone ? 15 : 18, lineHeight: 1.65, color: T2, maxWidth: 640 }}>Tudo num só lugar.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: isPhone ? 8 : 12, marginTop: isPhone ? 16 : 28, maxWidth: 560 }}>
                {sections.map((text, index) => (
                  <div key={text} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: isPhone ? "8px 10px" : "0", background: isPhone ? "rgba(255,255,255,.03)" : "transparent", borderRadius: isPhone ? 12 : 0, border: isPhone ? "1px solid " + BD : "none" }}>
                    <span style={{ width: isPhone ? 24 : 28, height: isPhone ? 24 : 28, borderRadius: "50%", background: `${G}16`, color: G, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>0{index + 1}</span>
                    <p style={{ color: T2, fontSize: isPhone ? 13 : 14, lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(8,12,24,0.75)", borderRadius: isPhone ? 18 : 22, padding: isPhone ? "16px 14px" : "24px 22px", boxShadow: "0 24px 50px rgba(0,0,0,.26)", border: "1px solid rgba(210,223,255,.16)" }}>
              <div style={{ display: "flex", alignItems: isPhone ? "stretch" : "center", flexDirection: isPhone ? "column" : "row", gap: isPhone ? 10 : 0, justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <p style={{ fontFamily: APP_FONT, fontWeight: 700, fontSize: isPhone ? 25 : 30, color: T }}>{isRegister ? "Criar conta" : "Entrar"}</p>
                  <p style={{ color: T3, fontSize: 13, marginTop: 5 }}>{isRegister ? "Cria acesso para abrir o teu dashboard." : "Entra para retomar a tua rota."}</p>
                </div>
                <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,.22)", borderRadius: 12, padding: 4, width: isPhone ? "100%" : "auto" }}>
                  {["login", "register"].map((tab) => (
                    <button key={tab} onClick={() => { setMode(tab); setError(""); }} style={{ ...bsm({ border: "none", padding: isPhone ? "10px 14px" : "8px 14px", borderRadius: 10, flex: isPhone ? 1 : "unset" }), background: mode === tab ? G : "transparent", color: mode === tab ? "#1a1205" : T2, fontWeight: mode === tab ? 700 : 500 }}>{tab === "login" ? "Login" : "Registar"}</button>
                  ))}
                </div>
              </div>

              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: isPhone ? 11 : 14 }}>
                {isRegister && (
                  <div>
                    <span style={lbl}>Nome</span>
                    <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: isPhone ? "13px 14px" : inp.padding }} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="O teu nome" />
                  </div>
                )}

                <div>
                  <span style={lbl}>Email</span>
                  <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: isPhone ? "13px 14px" : inp.padding }} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="tu@exemplo.com" />
                </div>

                <div>
                  <span style={lbl}>Password</span>
                  <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: isPhone ? "13px 14px" : inp.padding }} type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                </div>

                {isRegister && (
                  <div>
                    <span style={lbl}>Confirmar password</span>
                    <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: isPhone ? "13px 14px" : inp.padding }} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Repete a password" />
                  </div>
                )}

                {error && <div style={{ background: RD + "14", color: RD, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{error}</div>}

                <button type="submit" style={{ ...btnG, width: "100%", justifyContent: "center", marginTop: 4, opacity: submitting ? 0.75 : 1, border: "none", padding: isPhone ? "13px 14px" : btnG.padding }} disabled={submitting}>{submitting ? "A processar..." : isRegister ? "Criar conta e entrar" : "Entrar"}</button>
              </form>

              <p style={{ fontSize: 12, color: T3, lineHeight: 1.6, marginTop: 14 }}>{hasUsers ? "Já existe uma conta? Faz login para continuar." : "Ainda não existe nenhuma conta. Cria a primeira para começar."}</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))", gap: isPhone ? 10 : 16 }}>
          {highlights.map((item, index) => (
            <div key={item.title} style={{ ...card({ padding: isPhone ? "14px 14px" : "22px 20px", background: index === 1 ? `linear-gradient(180deg, ${S2}, ${S1})` : S1, border: "none", boxShadow: "0 18px 40px rgba(0,0,0,.16)" }) }}>
              <p style={{ fontSize: 12, color: G, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>0{index + 1}</p>
              <h2 style={{ fontFamily: APP_FONT, fontWeight: 700, fontSize: isPhone ? 19 : 24, lineHeight: 1.2, marginBottom: 10, color: T }}>{item.title}</h2>
              <p style={{ fontSize: isPhone ? 13 : 14, lineHeight: 1.65, color: T2 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
