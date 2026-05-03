import { useEffect, useMemo, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  G,
  S2,
  BD,
  BD2,
  T,
  T2,
  T3,
  GR,
  RD,
  BL,
  PU,
  CURRENCIES,
  fmtF,
  card,
  btnG,
  bsm,
  inp,
  lbl,
  Modal,
  ProgressBar,
  toChf,
  toBaseCurrency,
} from "./shared";
import {
  buildTransactionFingerprint,
  createDefaultFinanceData,
  findCategoryByName,
  monthKeyFromDate,
  normalizeFinanceData,
} from "../../lib/finance";

const ACCOUNT_TYPES = new Set(["bank", "savings"]);
const CATEGORY_COLORS = [G, BL, GR, PU, "#e08855", "#5fd2e6", "#ff9f68", RD, T2];
const FINANCE_TABS = [
  { key: "overview", label: "Painel" },
  { key: "transactions", label: "Movimentos" },
  { key: "planning", label: "Planeamento" },
];
const TRANSACTION_SOURCES = [
  { value: "all", label: "Todas as origens" },
  { value: "manual", label: "Manual" },
  { value: "ai-import", label: "AI" },
];
const PLANNING_TABS = [
  { key: "allocations", label: "ALOCAÇÕES MENSAIS" },
  { key: "categories", label: "CATEGORIAS" },
  { key: "allocation-status", label: "ESTADO DAS ALOCAÇÕES" },
];
const OVERVIEW_SECTIONS = [
  { key: "summary", label: "Resumo" },
  { key: "comparison", label: "Gráfico" },
  { key: "breakdown", label: "Categorias" },
];

const DEFAULT_TRANSACTION_FILTERS = {
  search: "",
  kind: "all",
  categoryId: "all",
  source: "all",
};
const FINANCE_UI_STATE_KEY = "finance_ui_state_v1";

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function currentDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function shiftMonth(monthValue, delta) {
  const [year, month] = String(monthValue || currentMonthValue()).split("-").map(Number);
  const next = new Date(year, (month || 1) - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function colorForIndex(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function normalizeAmount(value) {
  return Math.abs(Number(String(value || "").replace(",", ".")) || 0);
}

function clampPage(page, pageCount) {
  return Math.min(Math.max(page, 1), Math.max(pageCount, 1));
}

function loadPersistedFinanceUiState() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(FINANCE_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...bsm({ padding: "8px 10px", fontSize: 12 }),
        background: active ? G + "18" : "transparent",
        color: active ? G : T3,
        border: "1px solid " + (active ? G + "45" : "transparent"),
        borderRadius: 10,
        fontWeight: active ? 700 : 500,
        whiteSpace: "nowrap",
        width: "100%",
      }}>
      {label}
    </button>
  );
}

function SectionToggleButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...bsm({ padding: "9px 12px", fontSize: 12 }),
        background: active ? G : "transparent",
        color: active ? "#111" : T2,
        border: "1px solid " + (active ? G : BD2),
        borderRadius: 10,
        fontWeight: 700,
      }}>
      {label}
    </button>
  );
}

function FinanceStat({ label, value, note, color = T, compact = false }) {
  return (
    <div style={{ ...card({ padding: compact ? "14px 14px" : "16px 18px" }), borderColor: color === T ? BD : color + "30" }}>
      <p style={{ fontSize: 11, color: T2, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: compact ? 16 : 18, color, fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
      {note && <p style={{ fontSize: 11, color: T3, marginTop: 5 }}>{note}</p>}
    </div>
  );
}

function MonthlyComparisonChart({ rows, categoryLabel, compact, currencyLabel }) {
  if (!rows.length) {
    return (
      <div style={{ height: compact ? 200 : 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 12, color: T3 }}>Sem dados para o período selecionado.</p>
      </div>
    );
  }

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: S2, border: "1px solid " + BD2, borderRadius: 8, padding: "9px 12px" }}>
        <p style={{ fontSize: 11, color: T2, marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 13, color: G, fontWeight: 700 }}>{currencyLabel} {fmtF(payload[0].value || 0)}</p>
        <p style={{ fontSize: 10, color: T3, marginTop: 2 }}>{categoryLabel}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={compact ? 210 : 250}>
      <AreaChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="financeComparisonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={G} stopOpacity={0.22} />
            <stop offset="95%" stopColor={G} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: T3 }} tickLine={false} axisLine={false} width={42} tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}K` : `${Math.round(value)}`)} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="value" stroke={G} strokeWidth={2} fill="url(#financeComparisonGrad)" dot={false} activeDot={{ r: 4, fill: G, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PaginationControls({ page, pageCount, onPageChange, compact = false }) {
  if (pageCount <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(pageCount, page + 1);
  for (let index = start; index <= end; index += 1) {
    pages.push(index);
  }

  if (!pages.includes(1)) {
    pages.unshift(1);
  }

  if (!pages.includes(pageCount)) {
    pages.push(pageCount);
  }

  const uniquePages = pages.filter((value, index) => pages.indexOf(value) === index);

  return (
    <div style={{ display: "flex", justifyContent: compact ? "stretch" : "space-between", alignItems: compact ? "stretch" : "center", gap: 10, flexWrap: "wrap", marginTop: 16, flexDirection: compact ? "column" : "row" }}>
      <p style={{ fontSize: 12, color: T3 }}>Página {page} de {pageCount}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: compact ? "100%" : "auto" }}>
        <button title="Página anterior" aria-label="Página anterior" onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={{ ...bsm({ padding: "8px 12px", flex: compact ? 1 : "unset" }), opacity: page <= 1 ? 0.45 : 1 }}>
          ←
        </button>
        {uniquePages.map((value) => (
          <button
            key={value}
            onClick={() => onPageChange(value)}
            style={{
              ...bsm({ padding: "8px 12px", minWidth: 42, flex: compact ? 1 : "unset" }),
              background: value === page ? G : "transparent",
              color: value === page ? "#111" : T2,
              border: "1px solid " + (value === page ? G : BD2),
            }}>
            {value}
          </button>
        ))}
        <button title="Página seguinte" aria-label="Página seguinte" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} style={{ ...bsm({ padding: "8px 12px", flex: compact ? 1 : "unset" }), opacity: page >= pageCount ? 0.45 : 1 }}>
          →
        </button>
      </div>
    </div>
  );
}

function ExpenseBreakdown({ rows, totalExpenses, currencyLabel }) {
  if (!rows.length) {
    return <p style={{ fontSize: 13, color: T3 }}>Ainda não existem despesas neste mês.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((row) => {
        const share = totalExpenses > 0 ? (row.amount / totalExpenses) * 100 : 0;
        return (
          <div key={row.categoryId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: row.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
              </div>
              <span style={{ fontSize: 12, color: T2 }}>{currencyLabel} {fmtF(row.amount)} · {share.toFixed(1)}%</span>
            </div>
            <ProgressBar value={row.amount} max={totalExpenses || 1} color={row.color} height={5} />
          </div>
        );
      })}
    </div>
  );
}

function AllocationCard({
  allocation,
  incomeTotal,
  actualAmount,
  categoriesById,
  onEdit,
  compact = false,
  currencyLabel,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}) {
  const targetAmount = incomeTotal * ((Number(allocation.percent) || 0) / 100);
  const progressMax = Math.max(targetAmount, actualAmount, 1);
  const remainingToTarget = Math.max(targetAmount - actualAmount, 0);
  const overspentAmount = Math.max(actualAmount - targetAmount, 0);
  const hasTarget = targetAmount > 0;
  const isOverTarget = hasTarget && overspentAmount > 0;
  const isOnTarget = hasTarget && Math.abs(targetAmount - actualAmount) < 0.01;
  const diffLabel = !hasTarget
    ? "Meta não definida"
    : isOverTarget
      ? "Excedido"
      : isOnTarget
        ? "Meta atingida"
        : "Falta gastar";
  const diffValue = !hasTarget ? 0 : isOverTarget ? overspentAmount : remainingToTarget;
  const diffColor = !hasTarget ? T2 : isOverTarget ? RD : isOnTarget ? GR : BL;
  const linkedCategories = allocation.categoryIds
    .map((id) => categoriesById[id])
    .filter(Boolean);

  return (
    <div style={{ ...card({ padding: "16px 18px" }) }}>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0,1fr) auto", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 14, color: T, fontWeight: 600 }}>{allocation.name}</p>
          <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>{Number(allocation.percent) || 0}% do rendimento mensal</p>
        </div>
        {selectionMode ? (
          <button
            onClick={onToggleSelect}
            title={selected ? "Remover da seleção" : "Selecionar para apagar"}
            aria-label={selected ? "Remover da seleção" : "Selecionar para apagar"}
            style={bsm({
              color: selected ? G : T2,
              borderColor: selected ? G + "35" : BD2,
              background: selected ? G + "1f" : "transparent",
              minWidth: 34,
              padding: "6px 10px",
            })}>
            {selected ? "Selecionado" : "Selecionar"}
          </button>
        ) : (
          <button onClick={onEdit} title="Editar alocação" aria-label="Editar alocação" style={bsm({ color: BL, borderColor: BL + "30", minWidth: 34, padding: "6px 10px" })}>Editar</button>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T2 }}>Meta mensal: {currencyLabel} {fmtF(targetAmount)}</span>
        <span style={{ fontSize: 12, color: actualAmount > targetAmount && targetAmount > 0 ? RD : GR }}>Actual: {currencyLabel} {fmtF(actualAmount)}</span>
      </div>
      <ProgressBar value={actualAmount} max={progressMax} color={actualAmount > targetAmount && targetAmount > 0 ? RD : G} height={6} />
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: diffColor, fontWeight: 700 }}>{diffLabel}: {currencyLabel} {fmtF(diffValue)}</span>
        {hasTarget && <span style={{ fontSize: 11, color: T3 }}>{Math.min((actualAmount / targetAmount) * 100, 999).toFixed(1)}% da meta</span>}
      </div>
      {linkedCategories.length > 0 && <p style={{ fontSize: 11, color: T3, marginTop: 10 }}>Ligado a: {linkedCategories.map((item) => item.name).join(", ")}</p>}
      {linkedCategories.length === 0 && <p style={{ fontSize: 11, color: T3, marginTop: 10 }}>Sem categorias ligadas.</p>}
    </div>
  );
}

function AllocationEditorModal({
  isCompact,
  title,
  draft,
  categories,
  incomeTotal,
  onChangeDraft,
  onCancel,
  onSave,
  savingLabel,
  currencyLabel,
}) {
  const targetAmount = incomeTotal * ((Number(draft.percent) || 0) / 100);

  return (
    <Modal title={title} onClose={onCancel} wide>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <span style={lbl}>Nome da alocação *</span>
          <input style={inp} value={draft.name} onChange={(e) => onChangeDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Despesas Fixas" />
        </div>
        <div>
          <span style={lbl}>Percentagem (%)</span>
          <input
            style={inp}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={draft.percent}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, percent: e.target.value }))}
          />
          <p style={{ fontSize: 11, color: T3, marginTop: 6 }}>Meta mensal estimada: {currencyLabel} {fmtF(targetAmount)}</p>
        </div>

        <div>
          <span style={lbl}>Categorias de despesa</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((category) => {
              const active = draft.categoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => onChangeDraft((prev) => ({
                    ...prev,
                    categoryIds: active
                      ? prev.categoryIds.filter((item) => item !== category.id)
                      : [...prev.categoryIds, category.id],
                  }))}
                  style={{
                    ...bsm({ padding: "6px 10px", fontSize: 11 }),
                    background: active ? category.color : "transparent",
                    color: active ? "#111" : T2,
                    border: "1px solid " + (active ? category.color : BD2),
                  }}>
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 8, flexWrap: "wrap" }}>
        <button title="Cancelar" aria-label="Cancelar" style={bsm({ width: isCompact ? "100%" : "auto" })} onClick={onCancel}>×</button>
        <button title={savingLabel} aria-label={savingLabel} style={{ ...btnG, width: isCompact ? "100%" : "auto" }} onClick={onSave}>✓</button>
      </div>
    </Modal>
  );
}

function TransactionCard({
  item,
  category,
  accountName,
  categories,
  bankAccounts,
  isEditing,
  draft,
  onEdit,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
  currencyLabel,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onAddToShared,
}) {
  const color = category?.color || T2;
  const draftCategories = categories.filter((entry) => entry.kind === (draft?.kind || "expense"));

  return (
    <div style={{ ...card({ padding: "14px 14px" }), borderColor: isEditing ? BL + "45" : color + "25" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          {isEditing ? (
            <>
              <input style={{ ...inp, marginBottom: 8 }} value={draft.description} onChange={(e) => onDraftChange("description", e.target.value)} placeholder="Descrição" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input style={inp} type="date" value={draft.date} onChange={(e) => onDraftChange("date", e.target.value)} />
                <select style={inp} value={draft.accountId} onChange={(e) => onDraftChange("accountId", e.target.value)}>
                  <option value="">Conta</option>
                  {bankAccounts.map((entry) => <option key={entry.id} value={String(entry.id)}>{entry.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: T, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.description}</p>
              <p style={{ color: T3, fontSize: 11 }}>{item.date} · {accountName || "—"}</p>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isEditing ? (
            <>
              <button title="Guardar" aria-label="Guardar" onClick={onSaveEdit} style={bsm({ color: G, borderColor: G + "30" })}>✓</button>
              <button title="Cancelar" aria-label="Cancelar" onClick={onCancelEdit} style={bsm({ color: T2, borderColor: BD2 })}>↩</button>
            </>
          ) : selectionMode ? (
            <button
              title={selected ? "Remover da seleção" : "Selecionar para apagar"}
              aria-label={selected ? "Remover da seleção" : "Selecionar para apagar"}
              onClick={onToggleSelect}
              style={bsm({
                color: selected ? G : T2,
                borderColor: selected ? G + "35" : BD2,
                background: selected ? G + "1f" : "transparent",
              })}>
              {selected ? "Selecionado" : "Selecionar"}
            </button>
          ) : (
            <>
              <button title="Editar" aria-label="Editar" onClick={onEdit} style={bsm({ color: BL, borderColor: BL + "30" })}>Editar</button>
              {item.kind === "expense" && (
                <button title="Conta conjunta" aria-label="Conta conjunta" onClick={onAddToShared} style={bsm({ color: G, borderColor: G + "40" })}>Partilhar</button>
              )}
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <select style={inp} value={draft.kind} onChange={(e) => onDraftChange("kind", e.target.value)}>
              <option value="expense">Despesa</option>
              <option value="income">Entrada</option>
            </select>
            <select style={inp} value={draft.categoryId} onChange={(e) => onDraftChange("categoryId", e.target.value)}>
              <option value="">Categoria</option>
              {draftCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </div>
          <input style={{ ...inp, marginBottom: 8 }} type="number" step="0.01" value={draft.amount} onChange={(e) => onDraftChange("amount", e.target.value)} placeholder="Montante" />
          <textarea style={{ ...inp, minHeight: 62, resize: "vertical" }} value={draft.notes} onChange={(e) => onDraftChange("notes", e.target.value)} placeholder="Notas" />
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color, border: "1px solid " + color + "40", background: color + "15", padding: "4px 8px", borderRadius: 999 }}>{category?.name || "Sem categoria"}</span>
            <span style={{ fontSize: 11, color: T3 }}>{item.source === "ai-import" ? "AI" : "Manual"}</span>
          </div>
          <p style={{ color: item.kind === "income" ? GR : RD, fontSize: 16, fontWeight: 700 }}>{item.kind === "income" ? "+" : "-"}{currencyLabel} {fmtF(item.amount)}</p>
        </>
      )}
    </div>
  );
}

function TransactionFormModal({ isCompact, transactionForm, setTransactionForm, kindOptions, bankAccounts, onSave, onClose }) {
  return (
    <Modal title="Nova Transação" onClose={onClose} wide>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>NOVA TRANSAÇÃO</p>
          <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Regista manualmente os movimentos do mês.</p>
        </div>
        <div style={{ display: "flex", gap: 6, width: isCompact ? "100%" : "auto" }}>
          {[{ key: "expense", label: "Despesa", symbol: "↘", color: RD }, { key: "income", label: "Entrada", symbol: "↗", color: GR }].map((option) => (
            <button title={option.label} aria-label={option.label} key={option.key} onClick={() => setTransactionForm((prev) => ({ ...prev, kind: option.key }))} style={{ ...bsm({ padding: "9px 12px", flex: isCompact ? 1 : "unset" }), background: transactionForm.kind === option.key ? option.color : "transparent", color: transactionForm.kind === option.key ? "#111" : T2, border: "1px solid " + (transactionForm.kind === option.key ? option.color : BD2) }}>{option.symbol}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div>
          <span style={lbl}>Conta *</span>
          <select style={inp} value={transactionForm.accountId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, accountId: e.target.value }))}>
            <option value="">Selecionar conta</option>
            {bankAccounts.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Data *</span>
          <input style={inp} type="date" value={transactionForm.date} onChange={(e) => setTransactionForm((prev) => ({ ...prev, date: e.target.value }))} />
        </div>
        <div>
          <span style={lbl}>Montante *</span>
          <input style={inp} type="number" step="0.01" placeholder="ex: 48.90" value={transactionForm.amount} onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))} />
        </div>
        <div>
          <span style={lbl}>Moeda *</span>
          <select style={inp} value={transactionForm.currency} onChange={(e) => setTransactionForm((prev) => ({ ...prev, currency: e.target.value }))}>
            {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Tipo *</span>
          <select style={inp} value={transactionForm.categoryId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
            <option value="">Selecionar categoria</option>
            {kindOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={lbl}>Descrição *</span>
        <input style={inp} placeholder="ex: Passe mensal, salário, eletricidade" value={transactionForm.description} onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))} />
      </div>
      <div style={{ marginTop: 12 }}>
        <span style={lbl}>Notas</span>
        <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={transactionForm.notes} onChange={(e) => setTransactionForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observações opcionais" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
        <button title="Cancelar" aria-label="Cancelar" style={bsm({ width: isCompact ? "100%" : "auto" })} onClick={onClose}>×</button>
        <button title="Adicionar transação" aria-label="Adicionar transação" style={{ ...btnG, width: isCompact ? "100%" : "auto" }} onClick={onSave}>✓</button>
      </div>
    </Modal>
  );
}

function StatementImportModal({ isCompact, fileInputRef, uploadFiles, setUploadFiles, uploadError, uploadResult, uploading, onImport, onClose, currencyLabel }) {
  return (
    <Modal title="Importar Extrato" onClose={onClose} wide>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>IMPORTAR EXTRATO</p>
        <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Envia imagens do extrato bancário para extrair automaticamente as transações do mês.</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} style={{ ...inp, padding: 10 }} />
      {uploadFiles.length > 0 && <p style={{ fontSize: 12, color: T2, marginTop: 10 }}>{uploadFiles.length} ficheiro(s) preparado(s) para importação.</p>}
      {uploadError && <p style={{ fontSize: 12, color: RD, marginTop: 10 }}>{uploadError}</p>}
      {uploadResult && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: S2, border: "1px solid " + BD }}>
          <p style={{ fontSize: 13, color: T, marginBottom: 6 }}>{uploadResult.imported} transações importadas</p>
          {uploadResult.skipped > 0 && <p style={{ fontSize: 11, color: T3, marginBottom: 8 }}>{uploadResult.skipped} movimento(s) ignorado(s) por já existirem.</p>}
          {uploadResult.preview?.length > 0 && uploadResult.preview.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: T2, paddingTop: 6 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.date} · {item.description}</span>
              <span>{item.kind === "income" ? "+" : "-"}{currencyLabel} {fmtF(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8, flexWrap: "wrap" }}>
        <button title="Fechar" aria-label="Fechar" style={bsm({ width: isCompact ? "100%" : "auto" })} onClick={onClose}>×</button>
        <button title="Importar via AI" aria-label="Importar via AI" style={{ ...btnG, width: isCompact ? "100%" : "auto", opacity: uploading || !uploadFiles.length ? 0.55 : 1 }} onClick={onImport} disabled={uploading || !uploadFiles.length}>{uploading ? "⟳" : "⤴"}</button>
      </div>
    </Modal>
  );
}

function DeleteAllocationsConfirmModal({ isCompact, allocations, onCancel, onConfirm }) {
  return (
    <Modal title="Confirmar eliminação" onClose={onCancel}>
      <p style={{ fontSize: 13, color: T2, lineHeight: 1.45, marginBottom: 12 }}>
        Vais apagar {allocations.length} alocação(ões). Confirma se são estas:
      </p>
      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid " + BD, borderRadius: 10, padding: "10px 12px", background: S2 }}>
        {allocations.map((allocation) => (
          <p key={allocation.id} style={{ fontSize: 12, color: T, marginBottom: 6 }}>
            • {allocation.name}
          </p>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 8, flexWrap: "wrap" }}>
        <button title="Cancelar" aria-label="Cancelar" style={bsm({ width: isCompact ? "100%" : "auto" })} onClick={onCancel}>Cancelar</button>
        <button
          title="Confirmar eliminação"
          aria-label="Confirmar eliminação"
          style={{ ...bsm({ width: isCompact ? "100%" : "auto", color: RD, borderColor: RD + "35", background: "rgba(255,255,255,.02)" }) }}
          onClick={onConfirm}>Confirmar
        </button>
      </div>
    </Modal>
  );
}

function DeleteTransactionsConfirmModal({ isCompact, transactions, currencyLabel, onCancel, onConfirm }) {
  return (
    <Modal title="Confirmar eliminação" onClose={onCancel}>
      <p style={{ fontSize: 13, color: T2, lineHeight: 1.45, marginBottom: 12 }}>
        Vais apagar {transactions.length} movimento(s). Confirma se são estes:
      </p>
      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid " + BD, borderRadius: 10, padding: "10px 12px", background: S2 }}>
        {transactions.map((item) => (
          <p key={item.id} style={{ fontSize: 12, color: T, marginBottom: 6 }}>
            • {item.date} · {item.description} · {item.kind === "income" ? "+" : "-"}{currencyLabel} {fmtF(item.amount)}
          </p>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 8, flexWrap: "wrap" }}>
        <button title="Cancelar" aria-label="Cancelar" style={bsm({ width: isCompact ? "100%" : "auto" })} onClick={onCancel}>Cancelar</button>
        <button
          title="Confirmar eliminação"
          aria-label="Confirmar eliminação"
          style={{ ...bsm({ width: isCompact ? "100%" : "auto", color: RD, borderColor: RD + "35", background: "rgba(255,255,255,.02)" }) }}
          onClick={onConfirm}>Confirmar
        </button>
      </div>
    </Modal>
  );
}

export default function FinancasSection({ portfolios, financeData, saveFinanceData, baseCurrency = "CHF", onUpdateBaseCurrency, fx = {}, onAddSharedExpenseFromMovement }) {
  const persistedUiState = useMemo(() => loadPersistedFinanceUiState(), []);
  const normalizedFinanceData = useMemo(() => normalizeFinanceData(financeData || createDefaultFinanceData()), [financeData]);
  const [selectedMonth, setSelectedMonth] = useState(() => persistedUiState?.selectedMonth || currentMonthValue());
  const [selectedAccountId, setSelectedAccountId] = useState(() => persistedUiState?.selectedAccountId || "all");
  const [activeTab, setActiveTab] = useState(() => {
    const nextTab = persistedUiState?.activeTab;
    return FINANCE_TABS.some((tab) => tab.key === nextTab) ? nextTab : "overview";
  });
  const [isCompact, setIsCompact] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [planningTab, setPlanningTab] = useState("allocations");
  const [allocationEditorState, setAllocationEditorState] = useState({
    open: false,
    mode: "create",
    allocationId: null,
    draft: { name: "", percent: "", categoryIds: [] },
  });
  const [allocationSelectionMode, setAllocationSelectionMode] = useState(false);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState([]);
  const [showDeleteAllocationsConfirm, setShowDeleteAllocationsConfirm] = useState(false);
  const [transactionFilters, setTransactionFilters] = useState(() => ({
    ...DEFAULT_TRANSACTION_FILTERS,
    ...(persistedUiState?.transactionFilters || {}),
  }));
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [comparisonMonths, setComparisonMonths] = useState(6);
  const [comparisonCategoryId, setComparisonCategoryId] = useState("all");
  const [activeOverviewSection, setActiveOverviewSection] = useState("summary");
  const [transactionForm, setTransactionForm] = useState({
    accountId: "",
    date: currentDateValue(),
    description: "",
    amount: "",
    currency: baseCurrency,
    kind: "expense",
    categoryId: "",
    notes: "",
  });
  const [categoryForm, setCategoryForm] = useState({ name: "", kind: "expense" });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [transactionSelectionMode, setTransactionSelectionMode] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [showDeleteTransactionsConfirm, setShowDeleteTransactionsConfirm] = useState(false);
  const [editingDraft, setEditingDraft] = useState({
    accountId: "",
    date: currentDateValue(),
    description: "",
    amount: "",
    kind: "expense",
    categoryId: "",
    notes: "",
  });
  const fileInputRef = useRef(null);
  const convertFromChf = (value) => toBaseCurrency(value, baseCurrency, fx);
  const mapTransactionToSharedExpense = (item) => ({
    description: item.description,
    amount: convertFromChf(item.amount),
    currency: baseCurrency,
    expenseDate: item.date,
    note: item.notes || "",
  });

  useEffect(() => {
    const checkCompact = () => setIsCompact(window.innerWidth <= 720);
    checkCompact();
    window.addEventListener("resize", checkCompact);
    return () => window.removeEventListener("resize", checkCompact);
  }, []);

  const bankAccounts = useMemo(() => {
    const direct = portfolios.filter((item) => ACCOUNT_TYPES.has(item.type));
    return direct.length ? direct : portfolios.filter((item) => item.assets?.some((asset) => asset.type === "fiat"));
  }, [portfolios]);

  useEffect(() => {
    if (!bankAccounts.length) {
      setSelectedAccountId("all");
      return;
    }

    const stillExists = selectedAccountId === "all" || bankAccounts.some((item) => String(item.id) === String(selectedAccountId));
    if (!stillExists) {
      setSelectedAccountId(String(bankAccounts[0].id));
    }
  }, [bankAccounts, selectedAccountId]);

  useEffect(() => {
    setTransactionForm((prev) => {
      const nextCategories = normalizedFinanceData.categories.filter((item) => item.kind === prev.kind);
      const nextCategoryId = nextCategories.some((item) => item.id === prev.categoryId) ? prev.categoryId : nextCategories[0]?.id || "";
      const defaultAccountId = prev.accountId || (selectedAccountId !== "all" ? String(selectedAccountId) : String(bankAccounts[0]?.id || ""));
      return { ...prev, accountId: defaultAccountId, categoryId: nextCategoryId, currency: prev.currency || baseCurrency };
    });
  }, [normalizedFinanceData.categories, selectedAccountId, bankAccounts, baseCurrency]);

  const monthTransactions = useMemo(() => {
    return normalizedFinanceData.transactions
      .filter((item) => {
        if (monthKeyFromDate(item.date) !== selectedMonth) return false;
        if (selectedAccountId !== "all" && String(item.accountId) !== String(selectedAccountId)) return false;
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [normalizedFinanceData.transactions, selectedMonth, selectedAccountId]);

  const categoriesById = useMemo(() => {
    return normalizedFinanceData.categories.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [normalizedFinanceData.categories]);

  const accountNameById = useMemo(() => {
    return portfolios.reduce((acc, item) => {
      acc[String(item.id)] = item.name;
      return acc;
    }, {});
  }, [portfolios]);

  const totals = useMemo(() => {
    return monthTransactions.reduce((acc, item) => {
      if (item.kind === "income") acc.income += item.amount;
      else acc.expense += item.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [monthTransactions]);
  const displayTotals = useMemo(() => ({
    income: convertFromChf(totals.income),
    expense: convertFromChf(totals.expense),
  }), [totals, baseCurrency, fx]);

  const expensesByCategory = useMemo(() => {
    const grouped = {};
    monthTransactions.filter((item) => item.kind === "expense").forEach((item) => {
      const category = categoriesById[item.categoryId] || { id: item.categoryId, name: "Sem categoria", color: T2 };
      if (!grouped[category.id]) {
        grouped[category.id] = { categoryId: category.id, name: category.name, color: category.color || T2, amount: 0 };
      }
      grouped[category.id].amount += item.amount;
    });
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [monthTransactions, categoriesById]);
  const displayExpensesByCategory = useMemo(() => (
    expensesByCategory.map((item) => ({ ...item, amount: convertFromChf(item.amount) }))
  ), [expensesByCategory, baseCurrency, fx]);

  const allocationStats = useMemo(() => {
    return normalizedFinanceData.allocations.map((allocation) => {
      const amount = monthTransactions
        .filter((item) => item.kind === "expense" && allocation.categoryIds.includes(item.categoryId))
        .reduce((sum, item) => sum + item.amount, 0);
      return { allocationId: allocation.id, amount };
    });
  }, [normalizedFinanceData.allocations, monthTransactions]);
  const displayAllocationMap = useMemo(() => {
    return allocationStats.reduce((acc, item) => {
      acc[item.allocationId] = convertFromChf(item.amount);
      return acc;
    }, {});
  }, [allocationStats, baseCurrency, fx]);

  const allocationMap = useMemo(() => {
    return allocationStats.reduce((acc, item) => {
      acc[item.allocationId] = item.amount;
      return acc;
    }, {});
  }, [allocationStats]);

  const allocationPercentTotal = normalizedFinanceData.allocations.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
  const topExpenseCategory = expensesByCategory[0] || null;
  const displayTopExpenseCategory = displayExpensesByCategory[0] || null;
  const expenseCategories = useMemo(() => normalizedFinanceData.categories.filter((item) => item.kind === "expense"), [normalizedFinanceData.categories]);
  const kindOptions = normalizedFinanceData.categories.filter((item) => item.kind === transactionForm.kind);
  const monthLabel = useMemo(() => new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" }), [selectedMonth]);
  const transactionFilterCategories = useMemo(() => {
    if (transactionFilters.kind === "all") return normalizedFinanceData.categories;
    return normalizedFinanceData.categories.filter((item) => item.kind === transactionFilters.kind);
  }, [normalizedFinanceData.categories, transactionFilters.kind]);
  const filteredMonthTransactions = useMemo(() => {
    const searchTerm = transactionFilters.search.trim().toLowerCase();

    return monthTransactions.filter((item) => {
      if (transactionFilters.kind !== "all" && item.kind !== transactionFilters.kind) return false;
      if (transactionFilters.categoryId !== "all" && item.categoryId !== transactionFilters.categoryId) return false;
      if (transactionFilters.source !== "all" && item.source !== transactionFilters.source) return false;
      if (!searchTerm) return true;

      const categoryName = categoriesById[item.categoryId]?.name || "";
      const accountName = accountNameById[item.accountId] || "";
      const noteText = item.notes || "";

      return [item.description, categoryName, accountName, noteText]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [monthTransactions, transactionFilters, categoriesById, accountNameById]);
  const transactionsPerPage = isCompact ? 6 : 8;
  const transactionPageCount = Math.max(1, Math.ceil(filteredMonthTransactions.length / transactionsPerPage));
  const currentTransactionsPage = clampPage(transactionsPage, transactionPageCount);
  const paginatedMonthTransactions = useMemo(() => {
    const start = (currentTransactionsPage - 1) * transactionsPerPage;
    return filteredMonthTransactions.slice(start, start + transactionsPerPage);
  }, [filteredMonthTransactions, currentTransactionsPage, transactionsPerPage]);
  const selectedExpenseTransactions = useMemo(() => (
    monthTransactions.filter((item) => selectedTransactionIds.includes(item.id) && item.kind === "expense")
  ), [monthTransactions, selectedTransactionIds]);

  const comparisonChartData = useMemo(() => {
    const months = [];
    for (let index = comparisonMonths - 1; index >= 0; index -= 1) {
      const month = shiftMonth(selectedMonth, -index);
      const [year, mon] = month.split("-");
      const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "short" }).replace(".", "") + `/${String(year).slice(2)}`;

      const value = normalizedFinanceData.transactions
        .filter((item) => {
          if (monthKeyFromDate(item.date) !== month) return false;
          if (selectedAccountId !== "all" && String(item.accountId) !== String(selectedAccountId)) return false;
          if (item.kind !== "expense") return false;
          if (comparisonCategoryId !== "all" && item.categoryId !== comparisonCategoryId) return false;
          return true;
        })
        .reduce((sum, item) => sum + item.amount, 0);

      months.push({ key: `${year}-${mon}`, label, value: convertFromChf(value) });
    }

    return months;
  }, [comparisonMonths, selectedMonth, normalizedFinanceData.transactions, selectedAccountId, comparisonCategoryId, baseCurrency, fx]);

  const comparisonCategoryLabel = comparisonCategoryId === "all"
    ? "Todas as categorias (despesas)"
    : expenseCategories.find((item) => item.id === comparisonCategoryId)?.name || "Categoria";

  useEffect(() => {
    setTransactionsPage(1);
  }, [selectedMonth, selectedAccountId, transactionFilters, isCompact]);

  useEffect(() => {
    if (transactionsPage !== currentTransactionsPage) {
      setTransactionsPage(currentTransactionsPage);
    }
  }, [transactionsPage, currentTransactionsPage]);

  useEffect(() => {
    setSelectedAllocationIds((prev) => prev.filter((id) => normalizedFinanceData.allocations.some((item) => item.id === id)));
  }, [normalizedFinanceData.allocations]);

  useEffect(() => {
    setSelectedTransactionIds((prev) => prev.filter((id) => normalizedFinanceData.transactions.some((item) => item.id === id)));
  }, [normalizedFinanceData.transactions]);

  useEffect(() => {
    if (planningTab !== "allocations") {
      setAllocationSelectionMode(false);
      setSelectedAllocationIds([]);
      setShowDeleteAllocationsConfirm(false);
    }
  }, [planningTab]);

  useEffect(() => {
    if (activeTab !== "transactions") {
      setTransactionSelectionMode(false);
      setSelectedTransactionIds([]);
      setShowDeleteTransactionsConfirm(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const uiState = {
      selectedMonth,
      selectedAccountId,
      activeTab,
      transactionFilters,
    };

    window.localStorage.setItem(FINANCE_UI_STATE_KEY, JSON.stringify(uiState));
  }, [selectedMonth, selectedAccountId, activeTab, transactionFilters]);

  const persistFinance = (updater) => {
    saveFinanceData((prev) => normalizeFinanceData(typeof updater === "function" ? updater(normalizeFinanceData(prev || createDefaultFinanceData())) : updater));
  };

  const closeTransactionModal = () => {
    setShowTransactionModal(false);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setUploadError("");
  };

  const saveTransaction = () => {
    const enteredAmount = normalizeAmount(transactionForm.amount);
    const amountInChf = toChf(enteredAmount, transactionForm.currency || "CHF", fx) ?? enteredAmount;
    if (!transactionForm.accountId || !transactionForm.date || !transactionForm.description.trim() || !enteredAmount || !transactionForm.categoryId) return;

    persistFinance((prev) => ({
      ...prev,
      transactions: [
        {
          id: Date.now(),
          accountId: String(transactionForm.accountId),
          date: transactionForm.date,
          description: transactionForm.description.trim(),
          amount: amountInChf,
          kind: transactionForm.kind,
          categoryId: transactionForm.categoryId,
          notes: transactionForm.notes.trim(),
          originalAmount: enteredAmount,
          originalCurrency: transactionForm.currency || "CHF",
          source: "manual",
          createdAt: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));

    setTransactionForm((prev) => ({ ...prev, date: currentDateValue(), description: "", amount: "", currency: baseCurrency, notes: "" }));
    setShowTransactionModal(false);
  };

  const startInlineEdit = (transaction) => {
    setEditingTransactionId(transaction.id);
    setEditingDraft({
      accountId: String(transaction.accountId || ""),
      date: transaction.date || currentDateValue(),
      description: transaction.description || "",
      amount: transaction.amount ? String(transaction.amount) : "",
      kind: transaction.kind === "income" ? "income" : "expense",
      categoryId: transaction.categoryId || "",
      notes: transaction.notes || "",
    });
  };

  const onInlineDraftChange = (field, value) => {
    setEditingDraft((prev) => {
      if (field === "kind") {
        const nextCategories = normalizedFinanceData.categories.filter((item) => item.kind === value);
        const nextCategoryId = nextCategories.some((item) => item.id === prev.categoryId) ? prev.categoryId : nextCategories[0]?.id || "";
        return { ...prev, kind: value, categoryId: nextCategoryId };
      }
      return { ...prev, [field]: value };
    });
  };

  const cancelInlineEdit = () => {
    setEditingTransactionId(null);
  };

  const saveInlineEdit = () => {
    if (editingTransactionId === null) return;
    const amount = normalizeAmount(editingDraft.amount);
    if (!editingDraft.accountId || !editingDraft.date || !editingDraft.description.trim() || !amount || !editingDraft.categoryId) return;

    persistFinance((prev) => ({
      ...prev,
      transactions: prev.transactions.map((item) => item.id === editingTransactionId
        ? {
          ...item,
          accountId: String(editingDraft.accountId),
          date: editingDraft.date,
          description: editingDraft.description.trim(),
          amount,
          kind: editingDraft.kind,
          categoryId: editingDraft.categoryId,
          notes: editingDraft.notes.trim(),
        }
        : item),
    }));

    setEditingTransactionId(null);
  };

  const startTransactionSelection = () => {
    setTransactionSelectionMode(true);
    setSelectedTransactionIds([]);
    setShowDeleteTransactionsConfirm(false);
    setEditingTransactionId(null);
  };

  const cancelTransactionSelection = () => {
    setTransactionSelectionMode(false);
    setSelectedTransactionIds([]);
    setShowDeleteTransactionsConfirm(false);
  };

  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactionIds((prev) => (
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    ));
  };

  const openDeleteSelectedTransactionsConfirm = () => {
    if (!selectedTransactionIds.length) return;
    setShowDeleteTransactionsConfirm(true);
  };

  const confirmDeleteSelectedTransactions = () => {
    if (!selectedTransactionIds.length) return;
    const idsToDelete = new Set(selectedTransactionIds);
    persistFinance((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((item) => !idsToDelete.has(item.id)),
    }));
    setShowDeleteTransactionsConfirm(false);
    setTransactionSelectionMode(false);
    setSelectedTransactionIds([]);
  };

  const shareSelectedTransactions = () => {
    if (!selectedExpenseTransactions.length) return;
    onAddSharedExpenseFromMovement?.({
      movements: selectedExpenseTransactions.map(mapTransactionToSharedExpense),
    });
    setTransactionSelectionMode(false);
    setSelectedTransactionIds([]);
    setShowDeleteTransactionsConfirm(false);
  };

  const addCategory = () => {
    const name = categoryForm.name.trim();
    if (!name) return;
    const alreadyExists = findCategoryByName(normalizedFinanceData.categories, name, categoryForm.kind);
    if (alreadyExists) return;

    persistFinance((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          id: `cat-custom-${Date.now()}`,
          name,
          kind: categoryForm.kind,
          color: colorForIndex(prev.categories.length),
          system: false,
        },
      ],
    }));

    setCategoryForm({ name: "", kind: "expense" });
  };

  const removeCategory = (categoryId) => {
    const category = categoriesById[categoryId];
    if (!category || category.system) return;
    persistFinance((prev) => ({
      ...prev,
      categories: prev.categories.filter((item) => item.id !== categoryId),
      allocations: prev.allocations.map((allocation) => ({ ...allocation, categoryIds: allocation.categoryIds.filter((item) => item !== categoryId) })),
      transactions: prev.transactions.map((item) => item.categoryId === categoryId ? { ...item, categoryId: "" } : item),
    }));
  };

  const openCreateAllocationEditor = () => {
    setAllocationEditorState({
      open: true,
      mode: "create",
      allocationId: null,
      draft: { name: "", percent: "", categoryIds: [] },
    });
  };

  const openEditAllocationEditor = (allocation) => {
    setAllocationEditorState({
      open: true,
      mode: "edit",
      allocationId: allocation.id,
      draft: {
        name: allocation.name || "",
        percent: Number(allocation.percent) || 0,
        categoryIds: Array.isArray(allocation.categoryIds) ? allocation.categoryIds : [],
      },
    });
  };

  const closeAllocationEditor = () => {
    setAllocationEditorState((prev) => ({ ...prev, open: false }));
  };

  const saveAllocationEditor = () => {
    const name = String(allocationEditorState.draft.name || "").trim();
    if (!name) return;

    const percent = Number(allocationEditorState.draft.percent) || 0;
    const categoryIds = Array.isArray(allocationEditorState.draft.categoryIds)
      ? allocationEditorState.draft.categoryIds
      : [];

    if (allocationEditorState.mode === "create") {
      persistFinance((prev) => ({
        ...prev,
        allocations: [...prev.allocations, { id: `alloc-${Date.now()}`, name, percent, categoryIds }],
      }));
    } else {
      persistFinance((prev) => ({
        ...prev,
        allocations: prev.allocations.map((item) => item.id === allocationEditorState.allocationId
          ? { ...item, name, percent, categoryIds }
          : item),
      }));
    }

    closeAllocationEditor();
  };

  const startAllocationSelection = () => {
    setAllocationSelectionMode(true);
    setSelectedAllocationIds([]);
  };

  const cancelAllocationSelection = () => {
    setAllocationSelectionMode(false);
    setSelectedAllocationIds([]);
    setShowDeleteAllocationsConfirm(false);
  };

  const toggleAllocationSelection = (allocationId) => {
    setSelectedAllocationIds((prev) => (
      prev.includes(allocationId)
        ? prev.filter((id) => id !== allocationId)
        : [...prev, allocationId]
    ));
  };

  const openDeleteSelectedAllocationsConfirm = () => {
    if (!selectedAllocationIds.length) return;
    setShowDeleteAllocationsConfirm(true);
  };

  const confirmDeleteSelectedAllocations = () => {
    if (!selectedAllocationIds.length) return;
    const idsToDelete = new Set(selectedAllocationIds);
    persistFinance((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((item) => !idsToDelete.has(item.id)),
    }));
    setShowDeleteAllocationsConfirm(false);
    setAllocationSelectionMode(false);
    setSelectedAllocationIds([]);
  };

  const importStatement = async () => {
    if (!uploadFiles.length) return;
    if (!bankAccounts.length) {
      setUploadError("Cria primeiro uma conta bancária no Patrimônio para associar as transações.");
      return;
    }

    const accountId = selectedAccountId !== "all" ? String(selectedAccountId) : String(bankAccounts[0].id);
    if (!accountId) return;

    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const images = await Promise.all(uploadFiles.map((file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }));

      const response = await fetch("/api/statement-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: accountNameById[accountId] || "Conta bancária",
          selectedMonth,
          categories: normalizedFinanceData.categories.map((item) => ({ name: item.name, kind: item.kind })),
          images,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível ler o extrato.");

      const now = Date.now();
      let categoryIndex = 0;
      const newCategories = [];
      const existingCategories = [...normalizedFinanceData.categories];
      const importedTransactions = (data.transactions || [])
        .map((item, index) => {
          const kind = item.kind === "income" ? "income" : "expense";
          const categoryName = String(item.category || (kind === "income" ? "Renda" : "Compras") || "").trim();
          let category = findCategoryByName([...existingCategories, ...newCategories], categoryName, kind);

          if (!category) {
            category = {
              id: `cat-import-${now}-${index}`,
              name: categoryName || (kind === "income" ? "Renda" : "Importado"),
              kind,
              color: colorForIndex(existingCategories.length + categoryIndex),
              system: false,
            };
            categoryIndex += 1;
            newCategories.push(category);
          }

          return {
            id: now + index,
            accountId,
            date: item.date,
            description: String(item.description || "Movimento importado").trim(),
            amount: normalizeAmount(item.amount),
            kind,
            categoryId: category.id,
            notes: String(item.notes || "").trim(),
            source: "ai-import",
            createdAt: new Date().toISOString(),
          };
        })
        .filter((item) => item.date && item.description && item.amount > 0);

      const existingFingerprints = new Set(normalizedFinanceData.transactions.map(buildTransactionFingerprint));
      const uniqueImportedTransactions = importedTransactions.filter((item) => {
        const fingerprint = buildTransactionFingerprint(item);
        if (existingFingerprints.has(fingerprint)) return false;
        existingFingerprints.add(fingerprint);
        return true;
      });

      if (!uniqueImportedTransactions.length) {
        setUploadResult({ imported: 0, skipped: importedTransactions.length, preview: [] });
        setUploading(false);
        return;
      }

      persistFinance((prev) => ({
        ...prev,
        categories: [...prev.categories, ...newCategories.filter((item) => !prev.categories.some((existing) => existing.id === item.id))],
        transactions: [...uniqueImportedTransactions, ...prev.transactions],
      }));

      setUploadResult({ imported: uniqueImportedTransactions.length, skipped: importedTransactions.length - uniqueImportedTransactions.length, preview: uniqueImportedTransactions.slice(0, 6) });
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowImportModal(false);
    } catch (error) {
      setUploadError(error.message || "Falha ao importar extrato.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Finanças</h2>
        <select
          value={baseCurrency}
          onChange={(e) => onUpdateBaseCurrency?.(e.target.value)}
          style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 12, background: S2, border: "1px solid " + BD2 }}>
          <option value="CHF">CHF</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <div style={{ ...card({ padding: isCompact ? "12px" : "14px 16px", marginBottom: 20, overflow: "hidden" }) }}>
        <div style={{ marginBottom: 10, background: S2, border: "1px solid " + BD, borderRadius: 12, padding: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 4 }}>
            {FINANCE_TABS.map((tab) => <TabButton key={tab.key} active={activeTab === tab.key} label={tab.label} onClick={() => setActiveTab(tab.key)} />)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "auto minmax(150px,170px) minmax(200px,240px)", gap: 8, alignItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 34px", gap: 6, alignItems: "center" }}>
            <button onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))} style={bsm({ padding: "7px 0", fontSize: 12, color: T2, borderColor: BD2 })}>←</button>
            <div style={{ background: S2, border: "1px solid " + BD, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: T2, fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</p>
            </div>
            <button onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))} style={bsm({ padding: "7px 0", fontSize: 12, color: T2, borderColor: BD2 })}>→</button>
          </div>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...inp, width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid " + BD, background: S2 }} />
          <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ ...inp, width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid " + BD, background: S2 }}>
            <option value="all">Todas as contas</option>
            {bankAccounts.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
          </select>
        </div>
      </div>

      {!bankAccounts.length && (
        <div style={{ ...card({ marginBottom: 20, borderColor: BL + "35" }) }}>
          <p style={{ color: T, fontSize: 15, marginBottom: 6 }}>Ainda não tens uma conta bancária elegível.</p>
          <p style={{ color: T3, fontSize: 13 }}>Cria uma carteira do tipo Banco ou Poupança no Patrimônio para começar a registar movimentos mensais.</p>
        </div>
      )}

      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
            <FinanceStat label="Entradas" value={`${baseCurrency} ${fmtF(displayTotals.income)}`} color={GR} compact={isCompact} />
            <FinanceStat label="Saídas" value={`${baseCurrency} ${fmtF(displayTotals.expense)}`} color={RD} compact={isCompact} />
            <FinanceStat label="Saldo" value={`${baseCurrency} ${fmtF(displayTotals.income - displayTotals.expense)}`} note={selectedAccountId === "all" ? "Todas as contas" : accountNameById[selectedAccountId]} color={displayTotals.income - displayTotals.expense >= 0 ? G : RD} compact={isCompact} />
            <FinanceStat label="Top categoria" value={topExpenseCategory ? topExpenseCategory.name : "—"} note={displayTopExpenseCategory ? `${baseCurrency} ${fmtF(displayTopExpenseCategory.amount)}` : "Sem dados"} color={topExpenseCategory?.color || T} compact={isCompact} />
          </div>

          <div style={{ ...card({ marginBottom: 20, padding: isCompact ? "12px" : "14px" }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>VER</p>
              </div>
              <span style={{ fontSize: 11, color: T3 }}>{monthLabel}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OVERVIEW_SECTIONS.map((section) => (
                <SectionToggleButton
                  key={section.key}
                  active={activeOverviewSection === section.key}
                  label={section.label}
                  onClick={() => setActiveOverviewSection(section.key)}
                />
              ))}
            </div>
          </div>

          {activeOverviewSection === "comparison" && (
            <div style={{ ...card({ marginBottom: 20, padding: isCompact ? "14px 12px" : "16px 16px" }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: isCompact ? "stretch" : "center", gap: 10, marginBottom: 12, flexWrap: "wrap", flexDirection: isCompact ? "column" : "row" }}>
                <div>
                  <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>COMPARAÇÃO MENSAL</p>
                  <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Evolução das despesas.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "120px 220px", gap: 8, width: isCompact ? "100%" : "auto" }}>
                  <select style={{ ...inp, padding: "8px 10px", fontSize: 12, border: "1px solid " + BD, background: S2 }} value={String(comparisonMonths)} onChange={(e) => setComparisonMonths(Number(e.target.value) || 6)}>
                    <option value="3">Últimos 3 meses</option>
                    <option value="6">Últimos 6 meses</option>
                    <option value="12">Últimos 12 meses</option>
                  </select>
                  <select style={{ ...inp, padding: "8px 10px", fontSize: 12, border: "1px solid " + BD, background: S2 }} value={comparisonCategoryId} onChange={(e) => setComparisonCategoryId(e.target.value)}>
                    <option value="all">Todas as categorias</option>
                    {expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              </div>
              <MonthlyComparisonChart rows={comparisonChartData} categoryLabel={comparisonCategoryLabel} compact={isCompact} currencyLabel={baseCurrency} />
            </div>
          )}

          {activeOverviewSection === "breakdown" && (
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ONDE GASTASTE MAIS</p>
                  <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Distribuição por categoria.</p>
                </div>
                <span style={{ fontSize: 11, color: T3 }}>{expensesByCategory.length} categoria(s)</span>
              </div>
              <ExpenseBreakdown rows={displayExpensesByCategory} totalExpenses={displayTotals.expense} currencyLabel={baseCurrency} />
            </div>
          )}

          {activeOverviewSection === "summary" && (
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>RESUMO RÁPIDO</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Visão rápida do mês.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: S2, border: "1px solid " + BD }}>
                  <p style={{ fontSize: 11, color: T3, marginBottom: 6 }}>Conta ativa</p>
                  <p style={{ fontSize: 14, color: T, fontWeight: 600 }}>{selectedAccountId === "all" ? "Todas as contas" : accountNameById[selectedAccountId] || "Conta"}</p>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: S2, border: "1px solid " + BD }}>
                  <p style={{ fontSize: 11, color: T3, marginBottom: 6 }}>Rácio de poupança</p>
                  <p style={{ fontSize: 16, color: totals.income > 0 && totals.income - totals.expense >= 0 ? G : T, fontWeight: 700 }}>
                    {totals.income > 0 ? `${(((totals.income - totals.expense) / totals.income) * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: S2, border: "1px solid " + BD }}>
                  <p style={{ fontSize: 11, color: T3, marginBottom: 6 }}>Movimentos registados</p>
                  <p style={{ fontSize: 16, color: T, fontWeight: 700 }}>{monthTransactions.length}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "transactions" && (
        <>
          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>MOVIMENTOS DO MÊS</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>
                  {isCompact
                    ? `${monthTransactions.length} movimento(s) no total do mês.`
                    : `${filteredMonthTransactions.length} movimento(s) após filtros${filteredMonthTransactions.length !== monthTransactions.length ? ` · ${monthTransactions.length} no total do mês` : ""}.`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isCompact ? "100%" : "auto" }}>
                {!transactionSelectionMode && (
                  <button title="Selecionar movimentos" aria-label="Selecionar movimentos" style={{ ...bsm({ padding: "10px 12px", flex: isCompact ? 1 : "unset", color: RD, borderColor: RD + "35" }) }} onClick={startTransactionSelection}>
                    Selecionar
                  </button>
                )}
                {transactionSelectionMode && (
                  <>
                    <span style={{ fontSize: 12, color: T2, alignSelf: "center" }}>{selectedTransactionIds.length} selecionado(s)</span>
                    <button title="Cancelar seleção" aria-label="Cancelar seleção" style={{ ...bsm({ padding: "10px 12px", flex: isCompact ? 1 : "unset", color: T2, borderColor: BD2 }) }} onClick={cancelTransactionSelection}>
                      Cancelar
                    </button>
                    <button title="Partilhar selecionados" aria-label="Partilhar selecionados" style={{ ...bsm({ padding: "10px 12px", flex: isCompact ? 1 : "unset", color: G, borderColor: G + "40", opacity: selectedExpenseTransactions.length ? 1 : 0.55 }) }} onClick={shareSelectedTransactions} disabled={!selectedExpenseTransactions.length}>
                      Partilhar selecionados ({selectedExpenseTransactions.length})
                    </button>
                    <button title="Apagar selecionados" aria-label="Apagar selecionados" style={{ ...bsm({ padding: "10px 12px", flex: isCompact ? 1 : "unset", color: RD, borderColor: RD + "35", opacity: selectedTransactionIds.length ? 1 : 0.55 }) }} onClick={openDeleteSelectedTransactionsConfirm} disabled={!selectedTransactionIds.length}>
                      Apagar selecionados
                    </button>
                  </>
                )}
                <button title="Upload de extrato" aria-label="Upload de extrato" style={{ ...bsm({ padding: "10px 12px", flex: isCompact ? 1 : "unset", color: BL, borderColor: BL + "30" }) }} onClick={() => setShowImportModal(true)}>
                  ⤴
                </button>
                <button title="Nova transação" aria-label="Nova transação" style={{ ...btnG, padding: "10px 14px", width: isCompact ? "100%" : "auto", flex: isCompact ? 1 : "unset" }} onClick={() => setShowTransactionModal(true)}>
                  +
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(220px,1.2fr) repeat(3,minmax(150px,1fr)) auto", gap: 10, marginBottom: 16, alignItems: "end" }}>
                <div>
                  <span style={lbl}>Pesquisar</span>
                  <input
                    style={inp}
                    value={transactionFilters.search}
                    onChange={(e) => setTransactionFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Descrição, conta, categoria ou nota"
                  />
                </div>
                <div>
                  <span style={lbl}>Tipo</span>
                  <select style={inp} value={transactionFilters.kind} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, kind: e.target.value, categoryId: "all" }))}>
                    <option value="all">Todos</option>
                    <option value="expense">Despesas</option>
                    <option value="income">Entradas</option>
                  </select>
                </div>
                <div>
                  <span style={lbl}>Categoria</span>
                  <select style={inp} value={transactionFilters.categoryId} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, categoryId: e.target.value }))}>
                    <option value="all">Todas</option>
                    {transactionFilterCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div>
                  <span style={lbl}>Origem</span>
                  <select style={inp} value={transactionFilters.source} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, source: e.target.value }))}>
                    {TRANSACTION_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <button title="Limpar filtros" aria-label="Limpar filtros" style={{ ...bsm({ padding: "10px 12px" }) }} onClick={() => setTransactionFilters(DEFAULT_TRANSACTION_FILTERS)}>
                  ⟲
                </button>
              </div>

            {filteredMonthTransactions.length === 0 ? (
              <p style={{ color: T3, fontSize: 13 }}>{monthTransactions.length === 0 ? "Ainda não existem movimentos registados para este mês." : "Nenhum movimento corresponde aos filtros actuais."}</p>
            ) : isCompact ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {paginatedMonthTransactions.map((item) => (
                  <TransactionCard
                    key={item.id}
                    item={{ ...item, amount: convertFromChf(item.amount) }}
                    category={categoriesById[item.categoryId]}
                    accountName={accountNameById[item.accountId]}
                    categories={normalizedFinanceData.categories}
                    bankAccounts={bankAccounts}
                    isEditing={!transactionSelectionMode && editingTransactionId === item.id}
                    draft={editingDraft}
                    onEdit={() => startInlineEdit(item)}
                    onDraftChange={onInlineDraftChange}
                    onSaveEdit={saveInlineEdit}
                    onCancelEdit={cancelInlineEdit}
                    currencyLabel={baseCurrency}
                    selectionMode={transactionSelectionMode}
                    selected={selectedTransactionIds.includes(item.id)}
                    onToggleSelect={() => toggleTransactionSelection(item.id)}
                    onAddToShared={() => onAddSharedExpenseFromMovement?.(mapTransactionToSharedExpense(item))}
                  />
                ))}
                <PaginationControls page={currentTransactionsPage} pageCount={transactionPageCount} onPageChange={setTransactionsPage} compact />
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid " + BD }}>
                      {["Data", "Conta", "Descrição", "Categoria", "Origem", "Montante", ""].map((heading) => (
                        <th key={heading} style={{ padding: "10px 8px", textAlign: "left", color: T2, fontSize: 11, fontWeight: 600 }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMonthTransactions.map((item) => {
                      const category = categoriesById[item.categoryId];
                      const color = category?.color || T2;
                      const isEditingRow = !transactionSelectionMode && editingTransactionId === item.id;
                      const isSelectedRow = selectedTransactionIds.includes(item.id);
                      const rowCategories = normalizedFinanceData.categories.filter((entry) => entry.kind === editingDraft.kind);
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid " + BD, background: isEditingRow ? BL + "10" : isSelectedRow ? G + "12" : "transparent" }}>
                          <td style={{ padding: "11px 8px", color: T2, fontSize: 12 }}>
                            {isEditingRow ? <input style={inp} type="date" value={editingDraft.date} onChange={(e) => onInlineDraftChange("date", e.target.value)} /> : item.date}
                          </td>
                          <td style={{ padding: "11px 8px", color: T, fontSize: 12 }}>
                            {isEditingRow ? (
                              <select style={inp} value={editingDraft.accountId} onChange={(e) => onInlineDraftChange("accountId", e.target.value)}>
                                <option value="">Conta</option>
                                {bankAccounts.map((entry) => <option key={entry.id} value={String(entry.id)}>{entry.name}</option>)}
                              </select>
                            ) : (accountNameById[item.accountId] || "—")}
                          </td>
                          <td style={{ padding: "11px 8px", color: T, fontSize: 13 }}>
                            {isEditingRow ? <input style={inp} value={editingDraft.description} onChange={(e) => onInlineDraftChange("description", e.target.value)} /> : item.description}
                          </td>
                          <td style={{ padding: "11px 8px" }}>
                            {isEditingRow ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                <select style={inp} value={editingDraft.kind} onChange={(e) => onInlineDraftChange("kind", e.target.value)}>
                                  <option value="expense">Despesa</option>
                                  <option value="income">Entrada</option>
                                </select>
                                <select style={inp} value={editingDraft.categoryId} onChange={(e) => onInlineDraftChange("categoryId", e.target.value)}>
                                  <option value="">Categoria</option>
                                  {rowCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                                </select>
                              </div>
                            ) : <span style={{ fontSize: 11, color, border: "1px solid " + color + "40", background: color + "15", padding: "4px 8px", borderRadius: 999 }}>{category?.name || "Sem categoria"}</span>}
                          </td>
                          <td style={{ padding: "11px 8px", color: T3, fontSize: 11 }}>{item.source === "ai-import" ? "AI" : "Manual"}</td>
                          <td style={{ padding: "11px 8px", color: isEditingRow ? T : item.kind === "income" ? GR : RD, fontSize: 13, fontWeight: 700 }}>
                            {isEditingRow ? <input style={inp} type="number" step="0.01" value={editingDraft.amount} onChange={(e) => onInlineDraftChange("amount", e.target.value)} /> : `${item.kind === "income" ? "+" : "-"}${baseCurrency} ${fmtF(convertFromChf(item.amount))}`}
                          </td>
                          <td style={{ padding: "11px 8px" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                              {isEditingRow ? (
                                <>
                                  <button title="Guardar" aria-label="Guardar" onClick={saveInlineEdit} style={bsm({ color: G, borderColor: G + "30" })}>✓</button>
                                  <button title="Cancelar" aria-label="Cancelar" onClick={cancelInlineEdit} style={bsm({ color: T2, borderColor: BD2 })}>↩</button>
                                </>
                              ) : transactionSelectionMode ? (
                                <button
                                  title={isSelectedRow ? "Remover da seleção" : "Selecionar para apagar"}
                                  aria-label={isSelectedRow ? "Remover da seleção" : "Selecionar para apagar"}
                                  onClick={() => toggleTransactionSelection(item.id)}
                                  style={bsm({
                                    color: isSelectedRow ? G : T2,
                                    borderColor: isSelectedRow ? G + "35" : BD2,
                                    background: isSelectedRow ? G + "1f" : "transparent",
                                  })}>
                                  {isSelectedRow ? "Selecionado" : "Selecionar"}
                                </button>
                              ) : (
                                <>
                                  <button title="Editar" aria-label="Editar" onClick={() => startInlineEdit(item)} style={bsm({ color: BL, borderColor: BL + "30" })}>Editar</button>
                                  {item.kind === "expense" && (
                                    <button
                                      title="Conta conjunta"
                                      aria-label="Conta conjunta"
                                      onClick={() => onAddSharedExpenseFromMovement?.(mapTransactionToSharedExpense(item))}
                                      style={bsm({ color: G, borderColor: G + "40" })}>
                                      Partilhar
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <PaginationControls page={currentTransactionsPage} pageCount={transactionPageCount} onPageChange={setTransactionsPage} />
              </>
            )}
          </div>

          {showTransactionModal && <TransactionFormModal isCompact={isCompact} transactionForm={transactionForm} setTransactionForm={setTransactionForm} kindOptions={kindOptions} bankAccounts={bankAccounts} onSave={saveTransaction} onClose={closeTransactionModal} />}
          {showImportModal && <StatementImportModal isCompact={isCompact} fileInputRef={fileInputRef} uploadFiles={uploadFiles} setUploadFiles={setUploadFiles} uploadError={uploadError} uploadResult={uploadResult} uploading={uploading} onImport={importStatement} onClose={closeImportModal} currencyLabel={baseCurrency} />}
          {showDeleteTransactionsConfirm && (
            <DeleteTransactionsConfirmModal
              isCompact={isCompact}
              transactions={monthTransactions
                .filter((item) => selectedTransactionIds.includes(item.id))
                .map((item) => ({ ...item, amount: convertFromChf(item.amount) }))}
              currencyLabel={baseCurrency}
              onCancel={() => setShowDeleteTransactionsConfirm(false)}
              onConfirm={confirmDeleteSelectedTransactions}
            />
          )}
        </>
      )}

      {activeTab === "planning" && (
        <>
          <div style={{ ...card({ marginBottom: 16, padding: isCompact ? "12px" : "14px" }) }}>
            <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 8 }}>
              {PLANNING_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPlanningTab(tab.key)}
                  style={{
                    ...bsm({ padding: "10px 12px", fontSize: 12 }),
                    background: planningTab === tab.key ? G : "transparent",
                    color: planningTab === tab.key ? "#111" : T2,
                    border: "1px solid " + (planningTab === tab.key ? G : BD2),
                    fontWeight: 700,
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {planningTab === "allocations" && (
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ALOCAÇÕES MENSAIS</p>
                  <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Define percentagens mensais e acompanha automaticamente a execução.</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: allocationPercentTotal === 100 ? GR : allocationPercentTotal > 100 ? RD : G }}>Total configurado: {allocationPercentTotal.toFixed(1)}%</span>
                  {!allocationSelectionMode && (
                    <button title="Selecionar para apagar" aria-label="Selecionar para apagar" style={bsm({ color: RD, borderColor: RD + "35", minWidth: 34, padding: "6px 10px" })} onClick={startAllocationSelection}>Selecionar</button>
                  )}
                  {allocationSelectionMode && (
                    <>
                      <span style={{ fontSize: 12, color: T2 }}>{selectedAllocationIds.length} selecionada(s)</span>
                      <button title="Cancelar seleção" aria-label="Cancelar seleção" style={bsm({ color: T2, borderColor: BD2, minWidth: 34, padding: "6px 10px" })} onClick={cancelAllocationSelection}>Cancelar</button>
                      <button title="Apagar selecionadas" aria-label="Apagar selecionadas" style={bsm({ color: RD, borderColor: RD + "35", minWidth: 34, padding: "6px 10px", opacity: selectedAllocationIds.length ? 1 : 0.55 })} onClick={openDeleteSelectedAllocationsConfirm} disabled={!selectedAllocationIds.length}>Apagar selecionadas</button>
                    </>
                  )}
                  <button title="Nova alocação" aria-label="Nova alocação" style={bsm({ color: G, borderColor: G + "30", minWidth: 34, padding: "6px 10px" })} onClick={openCreateAllocationEditor}>+</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {normalizedFinanceData.allocations.map((allocation) => (
                  <AllocationCard
                    key={allocation.id}
                    allocation={allocation}
                    incomeTotal={displayTotals.income}
                    actualAmount={displayAllocationMap[allocation.id] || 0}
                    categoriesById={categoriesById}
                    compact={isCompact}
                    onEdit={() => openEditAllocationEditor(allocation)}
                    currencyLabel={baseCurrency}
                    selectionMode={allocationSelectionMode}
                    selected={selectedAllocationIds.includes(allocation.id)}
                    onToggleSelect={() => toggleAllocationSelection(allocation.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {planningTab === "categories" && (
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>CATEGORIAS</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Cria e gere os tipos de transação usados no mês.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1fr) 130px auto", gap: 10, marginBottom: 14 }}>
                <input style={inp} placeholder="Novo tipo, ex: Internet" value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} />
                <select style={inp} value={categoryForm.kind} onChange={(e) => setCategoryForm((prev) => ({ ...prev, kind: e.target.value }))}>
                  <option value="expense">Despesa</option>
                  <option value="income">Entrada</option>
                </select>
                <button title="Criar categoria" aria-label="Criar categoria" style={bsm({ padding: "10px 12px", color: G, borderColor: G + "30" })} onClick={addCategory}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {normalizedFinanceData.categories.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 999, border: "1px solid " + BD2, background: item.color + "15" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color }} />
                    <span style={{ fontSize: 12, color: T }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: T3 }}>{item.kind === "income" ? "entrada" : "despesa"}</span>
                    {!item.system && <button onClick={() => removeCategory(item.id)} style={bsm({ padding: "2px 6px", fontSize: 10, color: RD, borderColor: RD + "35" })}>×</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {planningTab === "allocation-status" && (
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ESTADO DAS ALOCAÇÕES</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Quanto do plano mensal já foi consumido.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {normalizedFinanceData.allocations.map((allocation) => {
                  const amount = displayAllocationMap[allocation.id] || 0;
                  const target = displayTotals.income * ((Number(allocation.percent) || 0) / 100);
                  return (
                    <div key={allocation.id} style={{ padding: "12px 14px", borderRadius: 14, background: S2, border: "1px solid " + BD }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: T }}>{allocation.name}</span>
                        <span style={{ fontSize: 11, color: T3 }}>{Number(allocation.percent) || 0}%</span>
                      </div>
                      <ProgressBar value={amount} max={Math.max(target, amount, 1)} color={amount > target && target > 0 ? RD : G} height={5} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allocationEditorState.open && (
            <AllocationEditorModal
              isCompact={isCompact}
              title={allocationEditorState.mode === "create" ? "Nova Alocação" : "Editar Alocação"}
              draft={allocationEditorState.draft}
              categories={normalizedFinanceData.categories.filter((item) => item.kind === "expense")}
              incomeTotal={displayTotals.income}
              onChangeDraft={(updater) => setAllocationEditorState((prev) => ({
                ...prev,
                draft: typeof updater === "function" ? updater(prev.draft) : updater,
              }))}
              onCancel={closeAllocationEditor}
              onSave={saveAllocationEditor}
              savingLabel={allocationEditorState.mode === "create" ? "Criar alocação" : "Guardar alterações"}
              currencyLabel={baseCurrency}
            />
          )}
          {showDeleteAllocationsConfirm && (
            <DeleteAllocationsConfirmModal
              isCompact={isCompact}
              allocations={normalizedFinanceData.allocations.filter((item) => selectedAllocationIds.includes(item.id))}
              onCancel={() => setShowDeleteAllocationsConfirm(false)}
              onConfirm={confirmDeleteSelectedAllocations}
            />
          )}
        </>
      )}
    </div>
  );
}
