import { useState, useEffect } from "react";
import {
  APP_FONT,
  BG,
  S2,
  T,
  T2,
  G,
  RD,
  bsm,
  btnG,
  inp,
  lbl,
  apiAuthRequest,
} from "./shared";

export default function HomeScreen({ hasUsers, onAuthenticated }) {
  const [mode, setMode] = useState(hasUsers ? "login" : "register");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMode(hasUsers ? "login" : "register");
  }, [hasUsers]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 820);
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
    <>
      <style>{`*{box-sizing:border-box;}html,body{min-height:100%;background:${BG};}body{margin:0;padding:0;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}`}</style>
      <div style={{ minHeight: "100dvh", background: `radial-gradient(circle at 18% -12%, #25335a 0%, ${S2} 34%, ${BG} 78%)`, color: T, padding: "max(12px, env(safe-area-inset-top, 0px)) 12px max(16px, env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ background: "rgba(8,12,24,0.78)", borderRadius: isMobile ? 18 : 22, padding: isMobile ? "18px 14px" : "24px 22px", boxShadow: "0 24px 50px rgba(0,0,0,.26)", border: "none", backdropFilter: "blur(14px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <img src="/apple-touch-icon.png" alt="Rota ao Milhão" style={{ width: 56, height: 56, borderRadius: 14, display: "block" }} />
          </div>

          <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,.22)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
            {["login", "register"].map((tab) => (
              <button key={tab} onClick={() => { setMode(tab); setError(""); }} style={{ ...bsm({ border: "none", padding: "10px 14px", borderRadius: 10, flex: 1 }), background: mode === tab ? G : "transparent", color: mode === tab ? "#1a1205" : T2, fontWeight: mode === tab ? 700 : 500 }}>
                {tab === "login" ? "Login" : "Registar"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {isRegister && (
              <div>
                <span style={lbl}>Nome</span>
                <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: "13px 14px", outline: "none", boxShadow: "none", WebkitAppearance: "none" }} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="O teu nome" />
              </div>
            )}

            <div>
              <span style={lbl}>Email</span>
              <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: "13px 14px", outline: "none", boxShadow: "none", WebkitAppearance: "none" }} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="tu@exemplo.com" />
            </div>

            <div>
              <span style={lbl}>Password</span>
              <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: "13px 14px", outline: "none", boxShadow: "none", WebkitAppearance: "none" }} type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>

            {isRegister && (
              <div>
                <span style={lbl}>Confirmar password</span>
                <input style={{ ...inp, border: "none", background: "rgba(255,255,255,.05)", padding: "13px 14px", outline: "none", boxShadow: "none", WebkitAppearance: "none" }} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Repete a password" />
              </div>
            )}

            {error && <div style={{ background: RD + "14", color: RD, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{error}</div>}

            <button type="submit" style={{ ...btnG, width: "100%", justifyContent: "center", marginTop: 4, opacity: submitting ? 0.75 : 1, border: "none", padding: "13px 14px", fontFamily: APP_FONT }} disabled={submitting}>
              {submitting ? "A processar..." : isRegister ? "Criar conta e entrar" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}
