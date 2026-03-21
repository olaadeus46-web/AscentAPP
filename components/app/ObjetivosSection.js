import { useState } from "react";
import {
  G,
  T,
  T2,
  T3,
  GR,
  RD,
  BL,
  PU,
  BD,
  S2,
  card,
  bsm,
  btn,
  btnG,
  inp,
  lbl,
  ProgressBar,
  Modal,
  apiGoalSuggestions,
} from "./shared";

export default function ObjetivosSection({ goals, saveGoals, onAddCalendarTask }) {
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
    if (edit) saveGoals(goals.map((x) => (x.id === edit ? { ...g, id: edit } : x)));
    else saveGoals([...goals, { ...g, id: Date.now() }]);
    setShow(false);
    setEdit(null);
    setForm(emp);
  };

  const loadAiSuggestions = async (goal) => {
    setAiByGoal((prev) => ({ ...prev, [goal.id]: { ...(prev[goal.id] || {}), loading: true, error: "" } }));

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
        saveGoals(goals.map((x) => (x.id === goal.id ? { ...x, aiSuggestions: [...newEntries, ...(x.aiSuggestions || [])] } : x)));
      }

      setAiByGoal((prev) => ({ ...prev, [goal.id]: { loading: false, error: "" } }));
    } catch (error) {
      setAiByGoal((prev) => ({ ...prev, [goal.id]: { loading: false, error: error.message || "Erro ao gerar sugestões" } }));
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Objetivos</h2>
        <button style={btnG} onClick={() => { setForm(emp); setEdit(null); setShow(true); }}>+ Novo Objetivo</button>
      </div>

      {goals.length === 0 ? (
        <div style={{ ...card({ padding: "60px 20px", textAlign: "center" }) }}>
          <p style={{ color: T2, fontSize: 15, marginBottom: 8 }}>Nenhum objetivo definido</p>
          <p style={{ color: T3, fontSize: 13 }}>Define marcos e hábitos para acelerar a jornada.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.map((g) => {
            const pct = Math.min((g.current / g.target) * 100, 100);
            const color = COLS[g.category] || T2;
            const done = g.current >= g.target;
            const dl = g.deadline ? Math.floor((new Date(g.deadline) - Date.now()) / 86400000) : null;
            const aiState = aiByGoal[g.id] || { loading: false, error: "" };
            const suggestionHistory = g.aiSuggestions || [];

            return (
              <div key={g.id} style={{ ...card({ borderLeft: "3px solid " + color, borderRadius: "0 12px 12px 0" }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: done ? GR : T }}>{g.title}</span>
                      <span style={{ fontSize: 10, color, background: color + "18", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{g.category}</span>
                      {done && <span style={{ fontSize: 10, color: GR, background: GR + "18", padding: "2px 8px", borderRadius: 20 }}>✓ CONCLUÍDO</span>}
                    </div>
                    <p style={{ fontSize: 13, color: T2 }}>
                      {g.unit === "CHF"
                        ? "CHF " + (g.current || 0).toLocaleString("de-CH") + " / CHF " + (g.target || 0).toLocaleString("de-CH")
                        : g.current + " / " + g.target + " " + g.unit}
                      {dl !== null && <span style={{ color: dl < 7 ? RD : T3, marginLeft: 10 }}>{dl < 0 ? "expirado" : dl + "d"}</span>}
                    </p>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600, color }}>{Math.round(pct)}%</span>
                </div>

                <ProgressBar value={g.current} max={g.target} color={done ? GR : color} height={6} />
                {g.notes && <p style={{ fontSize: 12, color: T3, fontStyle: "italic", marginTop: 8 }}>{g.notes}</p>}

                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                  <input type="number" placeholder="Progresso actual" value={g.current || ""} onChange={(e) => saveGoals(goals.map((x) => (x.id === g.id ? { ...x, current: parseFloat(e.target.value) || 0 } : x)))} style={{ ...inp, width: 140, padding: "6px 10px", fontSize: 13 }} />
                  <button onClick={() => { setForm({ ...g }); setEdit(g.id); setShow(true); }} style={bsm()}>Editar</button>
                  <button onClick={() => loadAiSuggestions(g)} disabled={aiState.loading} style={{ ...bsm({ color: BL, borderColor: BL + "30" }), opacity: aiState.loading ? 0.65 : 1 }}>{aiState.loading ? "AI..." : "Sugestões AI"}</button>
                  <button onClick={() => saveGoals(goals.filter((x) => x.id !== g.id))} style={bsm({ color: RD, borderColor: RD + "30" })}>×</button>
                </div>

                {(aiState.error || suggestionHistory.length > 0) && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {aiState.error && <p style={{ fontSize: 12, color: RD }}>{aiState.error}</p>}

                    {suggestionHistory.map((suggestion) => (
                      <div key={suggestion.id} style={{ background: S2, border: "1px solid " + BD, borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ fontSize: 13, color: T, fontWeight: 600 }}>{suggestion.title}</p>
                        {suggestion.notes && <p style={{ fontSize: 12, color: T3, marginTop: 4, lineHeight: 1.5 }}>{suggestion.notes}</p>}
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => onAddCalendarTask?.(g, suggestion)} style={bsm({ color: G, borderColor: G + "30", fontSize: 11, padding: "5px 10px" })}>+ Adicionar ao calendário</button>
                          <button onClick={() => saveGoals(goals.map((x) => (x.id === g.id ? { ...x, aiSuggestions: (x.aiSuggestions || []).filter((s) => s.id !== suggestion.id) } : x)))} style={bsm({ color: RD, borderColor: RD + "30", fontSize: 11, padding: "5px 10px" })}>Apagar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <Modal title={edit ? "Editar Objetivo" : "Novo Objetivo"} onClose={() => { setShow(false); setEdit(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><span style={lbl}>Título *</span><input style={inp} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex: Fundo de emergência 20.000 CHF" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Categoria</span><select style={inp} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><span style={lbl}>Unidade</span><select style={inp} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>{["CHF", "%", "h/sem", "vezes", "livros", "outro"].map((u) => <option key={u}>{u}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Actual</span><input style={inp} type="number" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} /></div>
              <div><span style={lbl}>Objetivo *</span><input style={inp} type="number" placeholder="ex: 20000" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} /></div>
            </div>
            <div><span style={lbl}>Prazo</span><input style={inp} type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></div>
            <div><span style={lbl}>Notas</span><input style={inp} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
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
