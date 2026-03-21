import { useState } from "react";
import {
  T,
  T2,
  T3,
  RD,
  IDEA_STATUSES,
  IDEA_CATS,
  card,
  bsm,
  btn,
  btnG,
  inp,
  lbl,
  Stars,
  Modal,
  G,
  S3,
  BD2,
} from "./shared";

export default function IdeiasSection({ ideas, saveIdeas }) {
  const [filter, setFilter] = useState("all");
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const emp = { title: "", description: "", category: "Digital", feasibility: 3, potential: 3, status: "idea", notes: "" };
  const [form, setForm] = useState(emp);

  const save = () => {
    if (!form.title.trim()) return;
    if (edit) saveIdeas(ideas.map((i) => (i.id === edit ? { ...form, id: edit } : i)));
    else saveIdeas([...ideas, { ...form, id: Date.now() }]);
    setShow(false);
    setEdit(null);
    setForm(emp);
  };

  const filtered = (filter === "all" ? ideas : ideas.filter((i) => i.status === filter))
    .slice()
    .sort((a, b) => b.potential + b.feasibility - (a.potential + a.feasibility));

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Ideias</h2>
        <button style={btnG} onClick={() => { setForm(emp); setEdit(null); setShow(true); }}>+ Nova Ideia</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ key: "all", label: "Todas (" + ideas.length + ")" }, ...IDEA_STATUSES.map((s) => ({ key: s.key, label: s.label + " (" + ideas.filter((i) => i.status === s.key).length + ")" }))].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...bsm({ padding: "7px 14px", fontSize: 12 }), background: filter === f.key ? G : "transparent", color: filter === f.key ? "#1a1205" : T2, border: "1px solid " + (filter === f.key ? G : BD2) }}>{f.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((idea) => {
          const si = IDEA_STATUSES.find((x) => x.key === idea.status) || IDEA_STATUSES[0];
          return (
            <div key={idea.id} style={card()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: T }}>{idea.title}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, border: "1px solid " + si.color + "40", color: si.color, background: si.color + "15" }}>{si.label}</span>
                <span style={{ fontSize: 11, color: T3, background: S3, padding: "2px 8px", borderRadius: 20 }}>{idea.category}</span>
              </div>
              {idea.description && <p style={{ fontSize: 13, color: T2, lineHeight: 1.5, marginBottom: 10 }}>{idea.description}</p>}
              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                <div><p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>POTENCIAL</p><Stars value={idea.potential} /></div>
                <div><p style={{ fontSize: 10, color: T3, marginBottom: 3 }}>VIABILIDADE</p><Stars value={idea.feasibility} /></div>
              </div>
              {idea.notes && <p style={{ fontSize: 12, color: T3, fontStyle: "italic", marginBottom: 10 }}>{idea.notes}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={idea.status} onChange={(e) => saveIdeas(ideas.map((i) => (i.id === idea.id ? { ...i, status: e.target.value } : i)))} style={{ ...inp, width: "auto", padding: "5px 10px", fontSize: 12 }}>
                  {IDEA_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button onClick={() => { setForm({ ...idea }); setEdit(idea.id); setShow(true); }} style={bsm()}>Editar</button>
                <button onClick={() => saveIdeas(ideas.filter((i) => i.id !== idea.id))} style={bsm({ color: RD, borderColor: RD + "30" })}>×</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ color: T3, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Nenhuma ideia aqui.</p>}
      </div>

      {show && (
        <Modal title={edit ? "Editar Ideia" : "Nova Ideia"} onClose={() => { setShow(false); setEdit(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><span style={lbl}>Nome *</span><input style={inp} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex: Newsletter sobre finanças" /></div>
            <div><span style={lbl}>Descrição</span><textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Categoria</span><select style={inp} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{IDEA_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><span style={lbl}>Estado</span><select style={inp} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{IDEA_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Potencial</span><Stars value={form.potential} onChange={(v) => setForm((f) => ({ ...f, potential: v }))} /></div>
              <div><span style={lbl}>Viabilidade</span><Stars value={form.feasibility} onChange={(v) => setForm((f) => ({ ...f, feasibility: v }))} /></div>
            </div>
            <div><span style={lbl}>Notas</span><textarea style={{ ...inp, minHeight: 55, resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
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
