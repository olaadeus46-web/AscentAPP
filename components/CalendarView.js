// components/CalendarView.js
// Adicionar ao index.js:
//   1. import CalendarView from "../components/CalendarView";
//   2. Adicionar { key: "calendario", label: "Calendário" } ao array NAV
//   3. Adicionar linha: {section === "calendario" && <CalendarView />}

import { useState, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const G   = "#c9a84c";
const GL  = "#e8c96a";
const BG  = "#0d0d10";
const S1  = "#141418";
const S2  = "#1c1c22";
const S3  = "#26262e";
const BD  = "rgba(255,255,255,0.07)";
const BD2 = "rgba(255,255,255,0.13)";
const T   = "#eeeeea";
const T2  = "#88888f";
const T3  = "#555560";
const GR  = "#4db87a";
const RD  = "#e05555";
const BL  = "#5599dd";
const PU  = "#aa77dd";

const SLOT_CATEGORIES = [
  { key: "work",     label: "Trabalho",   color: BL   },
  { key: "finance",  label: "Finanças",   color: G    },
  { key: "personal", label: "Pessoal",    color: PU   },
  { key: "health",   label: "Saúde",      color: GR   },
  { key: "learning", label: "Estudo",     color: "#e08855" },
  { key: "other",    label: "Outro",      color: T2   },
];

const SLOT_STATUS = [
  { key: "todo",       label: "Por fazer",   color: T2 },
  { key: "inprogress", label: "Em curso",    color: G  },
  { key: "done",       label: "Concluído",   color: GR },
  { key: "cancelled",  label: "Cancelado",   color: RD },
];

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function firstWeekday(year, month) { return new Date(year, month, 1).getDay(); }
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function parseTime(t) { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + (m || 0); }
function minutesToTime(m) { return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
function slotDuration(slot) { const s = parseTime(slot.startTime), e = parseTime(slot.endTime); return e > s ? e - s : 0; }

// ─── STYLES ──────────────────────────────────────────────────────────────────
const card = (x = {}) => ({ background: S1, border: "1px solid " + BD, borderRadius: 12, padding: "20px 22px", ...x });
const btn  = (x = {}) => ({ padding: "10px 20px", borderRadius: 8, border: "1px solid " + BD2, background: "transparent", color: T, fontFamily: "'Outfit',sans-serif", fontSize: 14, cursor: "pointer", fontWeight: 500, transition: "all .15s", ...x });
const btnG = { ...btn(), background: G, border: "1px solid " + GL, color: "#1a1205" };
const bsm  = (x = {}) => btn({ padding: "6px 12px", fontSize: 12, ...x });
const inp  = { background: S2, border: "1px solid " + BD2, borderRadius: 8, padding: "10px 14px", color: T, fontFamily: "'Outfit',sans-serif", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
const lbl  = { fontSize: 12, color: T2, fontWeight: 500, marginBottom: 6, display: "block" };

// ─── SLOT FORM MODAL ─────────────────────────────────────────────────────────
function SlotModal({ slot, defaultDate, onSave, onClose, onDelete, isMobile }) {
  const empty = {
    title: "", category: "work", status: "todo",
    date: defaultDate || toISO(new Date()),
    startTime: "09:00", endTime: "10:00",
    notes: "", recurring: "none",
  };
  const [form, setForm] = useState(slot ? { ...slot } : empty);

  const RECURRING = [
    { key: "none",    label: "Sem repetição" },
    { key: "daily",   label: "Diário" },
    { key: "weekly",  label: "Semanal" },
    { key: "monthly", label: "Mensal" },
  ];

  const save = () => {
    if (!form.title.trim()) return;
    if (parseTime(form.endTime) <= parseTime(form.startTime)) {
      alert("A hora de fim deve ser depois da hora de início.");
      return;
    }
    onSave({ ...form, id: form.id || Date.now() });
  };

  const cat = SLOT_CATEGORIES.find(c => c.key === form.category);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S1, border: "1px solid " + BD2, borderRadius: 16, padding: isMobile ? "20px 16px 18px" : "28px 28px 24px", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T }}>
            {slot?.id ? "Editar Slot" : "Novo Slot de Tempo"}
          </span>
          <button onClick={onClose} style={bsm()}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <span style={lbl}>Título *</span>
            <input style={inp} placeholder="ex: Revisão do portfolio, Estudo de Java..."
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Category */}
          <div>
            <span style={lbl}>Categoria</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {SLOT_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key }))}
                  style={{ ...bsm({ fontSize: 12, padding: "6px 12px" }), background: form.category === c.key ? c.color : "transparent", color: form.category === c.key ? "#111" : T2, border: "1px solid " + (form.category === c.key ? c.color : BD2) }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Status */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <span style={lbl}>Data</span>
              <input style={inp} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <span style={lbl}>Estado</span>
              <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {SLOT_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Time range */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <span style={lbl}>Hora início</span>
              <select style={inp} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}>
                {Array.from({ length: 48 }, (_, i) => minutesToTime(i * 30)).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Hora fim</span>
              <select style={inp} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}>
                {Array.from({ length: 48 }, (_, i) => minutesToTime(i * 30)).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Duration display */}
          {parseTime(form.endTime) > parseTime(form.startTime) && (
            <p style={{ fontSize: 12, color: cat?.color || T2, marginTop: -6 }}>
              Duração: {slotDuration(form)} min ({(slotDuration(form) / 60).toFixed(1)}h)
            </p>
          )}

          {/* Recurring */}
          <div>
            <span style={lbl}>Repetição</span>
            <select style={inp} value={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.value }))}>
              {RECURRING.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <span style={lbl}>Notas</span>
            <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} placeholder="Detalhes, links, contexto..."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexDirection: isMobile ? "column" : "row" }}>
            {slot?.id && (
              <button onClick={() => onDelete(slot.id)} style={{ ...bsm({ padding: "10px 16px", color: RD, borderColor: RD + "30", fontSize: 13 }) }}>
                Eliminar
              </button>
            )}
            <button style={{ ...btn({ flex: 1 }) }} onClick={onClose}>Cancelar</button>
            <button style={{ ...btnG, flex: 1 }} onClick={save}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIRM DELETE DIALOG ────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: S1, border: "1px solid " + BD2, borderRadius: 14, padding: "26px 28px 22px", width: "100%", maxWidth: 360 }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T, marginBottom: 10 }}>{title}</p>
        <p style={{ fontSize: 13, color: T2, lineHeight: 1.6, marginBottom: 22 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...btn({ flex: 1, padding: "9px 0" }) }}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...btn({ flex: 1, padding: "9px 0", background: RD + "18", color: RD, borderColor: RD + "40" }) }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ─── DAY PANEL ───────────────────────────────────────────────────────────────
function DayPanel({ date, slots, onAdd, onEdit, onClose, onToggleDone, onDelete, isMobile }) {
  const [confirmSlot, setConfirmSlot] = useState(null);

  const daySlots  = slots.filter(s => s.date === date).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const totalMins = daySlots.reduce((s, slot) => s + slotDuration(slot), 0);
  const doneMins  = daySlots.filter(s => s.status === "done").reduce((s, slot) => s + slotDuration(slot), 0);
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ ...card({ padding: 0, height: "100%", display: "flex", flexDirection: "column", minHeight: isMobile ? 420 : 500 }) }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid " + BD, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}>
        <div>
          <p style={{ fontSize: 11, color: T3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{dateLabel}</p>
          {totalMins > 0 && (
            <p style={{ fontSize: 12, color: T2 }}>
              {(totalMins / 60).toFixed(1)}h planeadas · <span style={{ color: GR }}>{(doneMins / 60).toFixed(1)}h concluídas</span>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...bsm({ color: G, borderColor: G + "30" }) }} onClick={onAdd}>+ Slot</button>
          <button style={bsm()} onClick={onClose}>×</button>
        </div>
      </div>

      {/* Slots */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {daySlots.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: T3, fontSize: 13, marginBottom: 12 }}>Nenhum slot planeado.</p>
            <button style={{ ...bsm({ color: G, borderColor: G + "30" }) }} onClick={onAdd}>+ Adicionar slot de tempo</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {daySlots.map(slot => {
              const cat    = SLOT_CATEGORIES.find(c => c.key === slot.category) || SLOT_CATEGORIES[5];
              const sta    = SLOT_STATUS.find(s => s.key === slot.status) || SLOT_STATUS[0];
              const dur    = slotDuration(slot);
              const isDone = slot.status === "done";

              return (
                <div key={slot.id}
                  style={{ display: "flex", gap: 10, padding: "12px 14px", background: cat.color + "0d", border: "1px solid " + cat.color + "30", borderRadius: 10, opacity: isDone ? .72 : 1, transition: "all .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = cat.color + "18"}
                  onMouseLeave={e => e.currentTarget.style.background = cat.color + "0d"}>

                  {/* Time column */}
                  <div style={{ flexShrink: 0, width: isMobile ? 56 : 66, textAlign: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: cat.color, fontFamily: "monospace" }}>{slot.startTime}</p>
                    <div style={{ width: 2, height: 10, background: cat.color + "40", margin: "3px auto" }} />
                    <p style={{ fontSize: 11, color: T3, fontFamily: "monospace" }}>{slot.endTime}</p>
                    <p style={{ fontSize: 10, color: T3, marginTop: 3 }}>{dur}m</p>
                  </div>

                  {/* Content — click to edit */}
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onEdit(slot)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? T3 : T, textDecoration: isDone ? "line-through" : "none" }}>
                        {slot.title}
                      </span>
                      <span style={{ fontSize: 10, color: sta.color, background: sta.color + "18", padding: "2px 7px", borderRadius: 20, fontWeight: 600 }}>{sta.label}</span>
                      <span style={{ fontSize: 10, color: cat.color, background: cat.color + "15", padding: "2px 7px", borderRadius: 20 }}>{cat.label}</span>
                    </div>
                    {slot.notes && <p style={{ fontSize: 12, color: T3, lineHeight: 1.5 }}>{slot.notes}</p>}
                    {slot.recurring !== "none" && (
                      <p style={{ fontSize: 11, color: T3, marginTop: 3 }}>
                        ↻ {slot.recurring === "daily" ? "diário" : slot.recurring === "weekly" ? "semanal" : "mensal"}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, justifyContent: "center" }}>
                    {/* Tick — mark done / undo */}
                    <button
                      title={isDone ? "Desmarcar concluído" : "Marcar como concluído"}
                      onClick={e => { e.stopPropagation(); onToggleDone(slot); }}
                      style={{
                        width: 30, height: 30, borderRadius: 7,
                        border: "1px solid " + (isDone ? GR + "70" : BD2),
                        background: isDone ? GR + "22" : "transparent",
                        color: isDone ? GR : T3,
                        cursor: "pointer", fontSize: 15,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .15s", lineHeight: 1,
                      }}
                      onMouseEnter={e => { if (!isDone) { e.currentTarget.style.borderColor = GR + "60"; e.currentTarget.style.color = GR; e.currentTarget.style.background = GR + "12"; } }}
                      onMouseLeave={e => { if (!isDone) { e.currentTarget.style.borderColor = BD2; e.currentTarget.style.color = T3; e.currentTarget.style.background = "transparent"; } }}>
                      ✓
                    </button>

                    {/* Trash — delete with confirm */}
                    <button
                      title="Eliminar slot"
                      onClick={e => { e.stopPropagation(); setConfirmSlot(slot); }}
                      style={{
                        width: 30, height: 30, borderRadius: 7,
                        border: "1px solid " + RD + "30",
                        background: "transparent", color: T3,
                        cursor: "pointer", fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = RD + "60"; e.currentTarget.style.color = RD; e.currentTarget.style.background = RD + "15"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = RD + "30"; e.currentTarget.style.color = T3; e.currentTarget.style.background = "transparent"; }}>
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary bar */}
      {totalMins > 0 && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid " + BD }}>
          <div style={{ height: 6, background: S3, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: (doneMins / totalMins * 100).toFixed(1) + "%", background: GR, borderRadius: 6, transition: "width .4s ease" }} />
          </div>
          <p style={{ fontSize: 11, color: T3, marginTop: 6, textAlign: "center" }}>
            {Math.round(doneMins / totalMins * 100)}% concluído · {daySlots.filter(s => s.status === "todo" || s.status === "inprogress").length} por fazer
          </p>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmSlot && (
        <ConfirmDialog
          title="Eliminar slot"
          message={`Tens a certeza que queres eliminar "${confirmSlot.title}"? Esta acção não pode ser desfeita.`}
          onConfirm={() => { onDelete(confirmSlot.id); setConfirmSlot(null); }}
          onCancel={() => setConfirmSlot(null)}
        />
      )}
    </div>
  );
}

// ─── WEEK STRIP ──────────────────────────────────────────────────────────────
function WeekStrip({ weekStart, slots, selectedDate, onSelectDate, isMobile }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "none" : "repeat(7,1fr)", gap: 6, marginBottom: 20, ...(isMobile ? { display: "flex", flexDirection: "column" } : {}) }}>
      {days.map((d, i) => {
        const iso      = toISO(d);
        const isToday  = iso === toISO(new Date());
        const isSel    = iso === selectedDate;
        const daySlots = slots.filter(s => s.date === iso);
        const hasDone  = daySlots.some(s => s.status === "done");
        const hasTodo  = daySlots.some(s => s.status === "todo" || s.status === "inprogress");

        return (
          <div key={i} onClick={() => onSelectDate(iso)}
           style={{ ...card({ padding: "10px 8px", textAlign: isMobile ? "left" : "center", cursor: "pointer", transition: "all .15s", borderColor: isSel ? G + "60" : isToday ? BD2 : BD, background: isSel ? G + "10" : S1, ...(isMobile ? { padding: "10px 12px" } : {}) }) }}
            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = S2; }}
            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = S1; }}>
            {isMobile ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, color: T3, marginBottom: 3 }}>{WEEKDAYS_SHORT[d.getDay()]}</p>
                  <p style={{ fontSize: 16, fontWeight: isToday ? 700 : 500, color: isSel ? G : isToday ? T : T2, lineHeight: 1 }}>{d.getDate()}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: T3 }}>{daySlots.length} slot{daySlots.length === 1 ? "" : "s"}</span>
                  <div style={{ display: "flex", justifyContent: "center", gap: 3, minHeight: 6 }}>
                    {hasTodo  && <div style={{ width: 5, height: 5, borderRadius: "50%", background: G }} />}
                    {hasDone  && <div style={{ width: 5, height: 5, borderRadius: "50%", background: GR }} />}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: T3, marginBottom: 4 }}>{WEEKDAYS_SHORT[d.getDay()]}</p>
                <p style={{ fontSize: 18, fontWeight: isToday ? 700 : 500, color: isSel ? G : isToday ? T : T2, lineHeight: 1 }}>
                  {d.getDate()}
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 6, minHeight: 6 }}>
                  {hasTodo  && <div style={{ width: 5, height: 5, borderRadius: "50%", background: G }} />}
                  {hasDone  && <div style={{ width: 5, height: 5, borderRadius: "50%", background: GR }} />}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MONTH GRID ──────────────────────────────────────────────────────────────
function MonthGrid({ year, month, slots, selectedDate, onSelectDate, isMobile }) {
  const numDays  = daysInMonth(year, month);
  const startDay = firstWeekday(year, month);
  const today    = toISO(new Date());

  // Build cells: empty prefix + days
  const cells = [...Array(startDay).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: T3, padding: "6px 0", fontWeight: 600, letterSpacing: .5 }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobile ? 3 : 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso      = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday  = iso === today;
          const isSel    = iso === selectedDate;
          const daySlots = slots.filter(s => s.date === iso);
          // Group by category for dots
          const cats = [...new Set(daySlots.map(s => s.category))].slice(0, 3);

          return (
            <div key={i} onClick={() => onSelectDate(isSel ? null : iso)}
              style={{ minHeight: isMobile ? 54 : 72, padding: isMobile ? "6px 4px" : "8px 6px", borderRadius: 8, cursor: "pointer", transition: "all .15s", background: isSel ? G + "15" : isToday ? S2 : S1, border: "1px solid " + (isSel ? G + "50" : isToday ? BD2 : BD) }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = S2; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? G + "15" : isToday ? S2 : S1; }}>

              {/* Day number */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: isToday ? 700 : 400, color: isSel ? G : isToday ? T : T2, lineHeight: 1 }}>
                  {day}
                </span>
                {isToday && <span style={{ fontSize: 8, color: G, background: G + "25", padding: "1px 5px", borderRadius: 10, fontWeight: 700, letterSpacing: .5 }}>HOJE</span>}
              </div>

              {/* Slot pills */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {isMobile ? (
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, minHeight: 6 }}>
                    {cats.map(catKey => {
                      const cat = SLOT_CATEGORIES.find(c => c.key === catKey);
                      return <div key={catKey} style={{ width: 5, height: 5, borderRadius: "50%", background: cat?.color || T3 }} />;
                    })}
                  </div>
                ) : daySlots.slice(0, 3).map(slot => {
                  const cat = SLOT_CATEGORIES.find(c => c.key === slot.category);
                  return (
                    <div key={slot.id} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: cat?.color + "25", color: cat?.color, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: slot.status === "done" ? "line-through" : "none" }}>
                      {slot.startTime} {slot.title}
                    </div>
                  );
                })}
                {!isMobile && daySlots.length > 3 && (
                  <div style={{ fontSize: 10, color: T3, paddingLeft: 5 }}>+{daySlots.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── UPCOMING PANEL ──────────────────────────────────────────────────────────
function UpcomingPanel({ slots, onEdit, onToggleDone }) {
  const today = toISO(new Date());
  const todaysTasks = slots
    .filter(s => s.date === today)
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  if (!todaysTasks.length) return null;

  return (
    <div style={{ ...card({ marginBottom: 20 }) }}>
      <p style={{ fontSize: 12, color: T2, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Tarefas de Hoje</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {todaysTasks.map(slot => {
          const cat = SLOT_CATEGORIES.find(c => c.key === slot.category) || SLOT_CATEGORIES[5];
          const isDone = slot.status === "done";
          return (
            <div key={slot.id} onClick={() => onEdit(slot)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: S2, border: "1px solid " + BD, cursor: "pointer", transition: "border-color .15s", opacity: isDone ? 0.72 : 1 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = cat.color + "50"}
              onMouseLeave={e => e.currentTarget.style.borderColor = BD}>
              <button
                title={isDone ? "Desmarcar concluído" : "Marcar como concluído"}
                onClick={e => { e.stopPropagation(); onToggleDone(slot); }}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: "1px solid " + (isDone ? GR + "70" : BD2),
                  background: isDone ? GR + "22" : "transparent",
                  color: isDone ? GR : T3,
                  cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s", lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!isDone) { e.currentTarget.style.borderColor = GR + "60"; e.currentTarget.style.color = GR; e.currentTarget.style.background = GR + "12"; } }}
                onMouseLeave={e => { if (!isDone) { e.currentTarget.style.borderColor = BD2; e.currentTarget.style.color = T3; e.currentTarget.style.background = "transparent"; } }}>
                ✓
              </button>
              <div style={{ width: 3, height: 36, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: isDone ? T3 : T, textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.title}</p>
                <p style={{ fontSize: 11, color: T3 }}>
                  <span style={{ color: G, fontWeight: 600 }}>Hoje</span>
                  {" · "}{slot.startTime}–{slot.endTime}
                </p>
              </div>
              <span style={{ fontSize: 10, color: cat.color, background: cat.color + "18", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{cat.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatsBar({ slots, isMobile }) {
  const today   = toISO(new Date());
  const todayS  = slots.filter(s => s.date === today);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekS   = slots.filter(s => s.date >= today && s.date <= toISO(weekEnd));
  const totalH  = slots.reduce((s, x) => s + slotDuration(x), 0) / 60;
  const doneH   = slots.filter(s => s.status === "done").reduce((s, x) => s + slotDuration(x), 0) / 60;

  const stats = [
    { label: "Slots hoje",      val: todayS.length,          sub: todayS.filter(s => s.status === "done").length + " concluídos" },
    { label: "Próximos 7 dias", val: weekS.length,           sub: (weekS.reduce((s, x) => s + slotDuration(x), 0) / 60).toFixed(1) + "h planeadas" },
    { label: "Horas totais",    val: totalH.toFixed(1) + "h", sub: doneH.toFixed(1) + "h concluídas" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} style={{ ...card({ padding: "14px 16px" }) }}>
          <p style={{ fontSize: 11, color: T2, marginBottom: 6 }}>{s.label}</p>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: T, lineHeight: 1 }}>{s.val}</p>
          <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN CALENDAR VIEW ──────────────────────────────────────────────────────
export default function CalendarView({ slots = [], onSaveSlots, newSlotPrefill, onConsumeNewSlotPrefill }) {
  const today = new Date();
  const [view,         setView]         = useState("month"); // "month" | "week"
  const [curYear,      setCurYear]      = useState(today.getFullYear());
  const [curMonth,     setCurMonth]     = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toISO(today));
  const [showModal,    setShowModal]    = useState(false);
  const [editSlot,     setEditSlot]     = useState(null);
  const [defaultDate,  setDefaultDate]  = useState(toISO(today));
  const [isMobile,     setIsMobile]     = useState(false);
  const [weekStart,    setWeekStart]    = useState(startOfWeek(today));

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 900);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!newSlotPrefill?.requestId) return;

    const date = newSlotPrefill.date || toISO(new Date());
    setSelectedDate(date);
    setDefaultDate(date);
    setEditSlot({
      title: newSlotPrefill.title || "",
      category: newSlotPrefill.category || "other",
      status: newSlotPrefill.status || "todo",
      date,
      startTime: newSlotPrefill.startTime || "09:00",
      endTime: newSlotPrefill.endTime || "10:00",
      notes: newSlotPrefill.notes || "",
      recurring: newSlotPrefill.recurring || "none",
    });
    setShowModal(true);
    onConsumeNewSlotPrefill?.();
  }, [newSlotPrefill, onConsumeNewSlotPrefill]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const onSaveSlot = (slot) => {
    let updated;
    if (slots.find(s => s.id === slot.id)) {
      updated = slots.map(s => s.id === slot.id ? slot : s);
    } else {
      updated = [...slots, slot];
    }
    onSaveSlots(updated);
    setShowModal(false);
    setEditSlot(null);
    if (slot.date) setSelectedDate(slot.date);
  };

  const onDeleteSlot = (id) => {
    onSaveSlots(slots.filter(s => s.id !== id));
    setShowModal(false); setEditSlot(null);
  };

  const onToggleDone = (slot) => {
    const newStatus = slot.status === "done" ? "todo" : "done";
    onSaveSlots(slots.map(s => s.id === slot.id ? { ...s, status: newStatus } : s));
  };

  const openNew = (date) => {
    setDefaultDate(date || selectedDate || toISO(today));
    setEditSlot(null);
    setShowModal(true);
  };

  const openEdit = (slot) => {
    setEditSlot(slot);
    setShowModal(true);
  };

  const prevWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const nextWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const prevMonth = () => { if (curMonth === 0) { setCurMonth(11); setCurYear(y => y - 1); } else setCurMonth(m => m - 1); };
  const nextMonth = () => { if (curMonth === 11) { setCurMonth(0); setCurYear(y => y + 1); } else setCurMonth(m => m + 1); };
  const goToday   = () => {
    setCurYear(today.getFullYear());
    setCurMonth(today.getMonth());
    setWeekStart(startOfWeek(today));
    setSelectedDate(toISO(today));
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Calendário</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={bsm({ color: T2 })} onClick={goToday}>Hoje</button>
          <div style={{ display: "flex", gap: 0, border: "1px solid " + BD2, borderRadius: 8, overflow: "hidden" }}>
            {["month", "week"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ ...bsm({ borderRadius: 0, border: "none", padding: "7px 14px", fontSize: 12 }), background: view === v ? G : "transparent", color: view === v ? "#1a1205" : T2 }}>
                {v === "month" ? "Mês" : "Semana"}
              </button>
            ))}
          </div>
          <button style={btnG} onClick={() => openNew(selectedDate)}>+ Slot</button>
        </div>
      </div>

      {/* Upcoming */}
      <UpcomingPanel slots={slots} onEdit={openEdit} onToggleDone={onToggleDone} />

      {/* Calendar area */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : selectedDate ? "1fr 340px" : "1fr", gap: 16, alignItems: "start" }}>

        {/* Left: calendar grid */}
        <div style={card()}>
          {/* Nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            {view === "week" ? (
              <>
                <button onClick={prevWeek} style={bsm()}>‹</button>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 16 : 18, color: T, textAlign: "center" }}>
                  {weekStart.getDate()} {MONTHS_PT[weekStart.getMonth()].slice(0, 3)} — {weekEnd.getDate()} {MONTHS_PT[weekEnd.getMonth()].slice(0, 3)}
                </span>
                <button onClick={nextWeek} style={bsm()}>›</button>
              </>
            ) : (
              <>
                <button onClick={prevMonth} style={bsm()}>‹</button>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T }}>
                  {MONTHS_PT[curMonth]} {curYear}
                </span>
                <button onClick={nextMonth} style={bsm()}>›</button>
              </>
            )}
          </div>

          {view === "week" ? (
            <WeekStrip weekStart={weekStart} slots={slots} selectedDate={selectedDate} onSelectDate={d => setSelectedDate(prev => prev === d ? null : d)} isMobile={isMobile} />
          ) : (
            <MonthGrid year={curYear} month={curMonth} slots={slots} selectedDate={selectedDate} onSelectDate={d => setSelectedDate(d)} isMobile={isMobile} />
          )}

          {/* Category legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid " + BD }}>
            {SLOT_CATEGORIES.map(c => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                <span style={{ fontSize: 11, color: T3 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: day panel */}
        {selectedDate && <DayPanel date={selectedDate} slots={slots} onAdd={() => openNew(selectedDate)} onEdit={openEdit} onClose={() => setSelectedDate(null)} onToggleDone={onToggleDone} onDelete={id => onSaveSlots(slots.filter(s => s.id !== id))} isMobile={isMobile} />}
      </div>

      {/* Modal */}
      {showModal && (
        <SlotModal
          slot={editSlot}
          defaultDate={defaultDate}
          onSave={onSaveSlot}
          onDelete={onDeleteSlot}
          isMobile={isMobile}
          onClose={() => { setShowModal(false); setEditSlot(null); }}
        />
      )}
    </div>
  );
}
