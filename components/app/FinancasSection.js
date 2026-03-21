import { useEffect, useMemo, useRef, useState } from "react";
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
  fmtF,
  card,
  btnG,
  bsm,
  inp,
  lbl,
  ProgressBar,
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

function TabButton({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...bsm({ padding: "10px 14px", fontSize: 12 }),
        background: active ? G : "rgba(255,255,255,.03)",
        color: active ? "#111" : T2,
        border: "1px solid " + (active ? G : BD2),
        whiteSpace: "nowrap",
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

function ExpenseBreakdown({ rows, totalExpenses }) {
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
              <span style={{ fontSize: 12, color: T2 }}>CHF {fmtF(row.amount)} · {share.toFixed(1)}%</span>
            </div>
            <ProgressBar value={row.amount} max={totalExpenses || 1} color={row.color} height={5} />
          </div>
        );
      })}
    </div>
  );
}

function AllocationCard({ allocation, incomeTotal, actualAmount, categories, onChange, onRemove, compact = false }) {
  const targetAmount = incomeTotal * ((Number(allocation.percent) || 0) / 100);
  const progressMax = Math.max(targetAmount, actualAmount, 1);
  const linkedCategories = categories.filter((item) => allocation.categoryIds.includes(item.id));

  return (
    <div style={{ ...card({ padding: "16px 18px" }) }}>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0,1fr) 110px auto", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <input style={inp} value={allocation.name} onChange={(e) => onChange({ ...allocation, name: e.target.value })} placeholder="Nome da alocação" />
        <input style={inp} type="number" min="0" max="100" step="0.1" value={allocation.percent} onChange={(e) => onChange({ ...allocation, percent: Number(e.target.value) || 0 })} />
        <button onClick={onRemove} style={bsm({ color: RD, borderColor: RD + "35" })}>Remover</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T2 }}>Meta mensal: CHF {fmtF(targetAmount)}</span>
        <span style={{ fontSize: 12, color: actualAmount > targetAmount && targetAmount > 0 ? RD : GR }}>Actual: CHF {fmtF(actualAmount)}</span>
      </div>
      <ProgressBar value={actualAmount} max={progressMax} color={actualAmount > targetAmount && targetAmount > 0 ? RD : G} height={6} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {categories.filter((item) => item.kind === "expense").map((category) => {
          const active = allocation.categoryIds.includes(category.id);
          return (
            <button
              key={category.id}
              onClick={() => onChange({
                ...allocation,
                categoryIds: active
                  ? allocation.categoryIds.filter((item) => item !== category.id)
                  : [...allocation.categoryIds, category.id],
              })}
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
      {linkedCategories.length > 0 && <p style={{ fontSize: 11, color: T3, marginTop: 10 }}>Ligado a: {linkedCategories.map((item) => item.name).join(", ")}</p>}
    </div>
  );
}

function TransactionCard({ item, category, accountName, categories, bankAccounts, isEditing, draft, onEdit, onDraftChange, onSaveEdit, onCancelEdit, onDelete }) {
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
              <button onClick={onSaveEdit} style={bsm({ color: G, borderColor: G + "30" })}>Guardar</button>
              <button onClick={onCancelEdit} style={bsm({ color: T2, borderColor: BD2 })}>Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={onEdit} style={bsm({ color: BL, borderColor: BL + "30" })}>Editar</button>
              <button onClick={onDelete} style={bsm({ color: RD, borderColor: RD + "30" })}>×</button>
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
          <p style={{ color: item.kind === "income" ? GR : RD, fontSize: 16, fontWeight: 700 }}>{item.kind === "income" ? "+" : "-"}CHF {fmtF(item.amount)}</p>
        </>
      )}
    </div>
  );
}

export default function FinancasSection({ portfolios, financeData, saveFinanceData }) {
  const normalizedFinanceData = useMemo(() => normalizeFinanceData(financeData || createDefaultFinanceData()), [financeData]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [isCompact, setIsCompact] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    accountId: "",
    date: currentDateValue(),
    description: "",
    amount: "",
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
      return { ...prev, accountId: defaultAccountId, categoryId: nextCategoryId };
    });
  }, [normalizedFinanceData.categories, selectedAccountId, bankAccounts]);

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

  const allocationStats = useMemo(() => {
    return normalizedFinanceData.allocations.map((allocation) => {
      const amount = monthTransactions
        .filter((item) => item.kind === "expense" && allocation.categoryIds.includes(item.categoryId))
        .reduce((sum, item) => sum + item.amount, 0);
      return { allocationId: allocation.id, amount };
    });
  }, [normalizedFinanceData.allocations, monthTransactions]);

  const allocationMap = useMemo(() => {
    return allocationStats.reduce((acc, item) => {
      acc[item.allocationId] = item.amount;
      return acc;
    }, {});
  }, [allocationStats]);

  const allocationPercentTotal = normalizedFinanceData.allocations.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
  const topExpenseCategory = expensesByCategory[0] || null;
  const kindOptions = normalizedFinanceData.categories.filter((item) => item.kind === transactionForm.kind);
  const monthLabel = useMemo(() => new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" }), [selectedMonth]);

  const persistFinance = (updater) => {
    saveFinanceData((prev) => normalizeFinanceData(typeof updater === "function" ? updater(normalizeFinanceData(prev || createDefaultFinanceData())) : updater));
  };

  const saveTransaction = () => {
    const amount = normalizeAmount(transactionForm.amount);
    if (!transactionForm.accountId || !transactionForm.date || !transactionForm.description.trim() || !amount || !transactionForm.categoryId) return;

    persistFinance((prev) => ({
      ...prev,
      transactions: [
        {
          id: Date.now(),
          accountId: String(transactionForm.accountId),
          date: transactionForm.date,
          description: transactionForm.description.trim(),
          amount,
          kind: transactionForm.kind,
          categoryId: transactionForm.categoryId,
          notes: transactionForm.notes.trim(),
          source: "manual",
          createdAt: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));

    setTransactionForm((prev) => ({ ...prev, date: currentDateValue(), description: "", amount: "", notes: "" }));
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

  const deleteTransaction = (id) => {
    persistFinance((prev) => ({ ...prev, transactions: prev.transactions.filter((item) => item.id !== id) }));
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

  const updateAllocation = (allocationId, nextAllocation) => {
    persistFinance((prev) => ({
      ...prev,
      allocations: prev.allocations.map((item) => item.id === allocationId ? nextAllocation : item),
    }));
  };

  const addAllocation = () => {
    persistFinance((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { id: `alloc-${Date.now()}`, name: "Nova alocação", percent: 0, categoryIds: [] }],
    }));
  };

  const removeAllocation = (allocationId) => {
    persistFinance((prev) => ({ ...prev, allocations: prev.allocations.filter((item) => item.id !== allocationId) }));
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
    } catch (error) {
      setUploadError(error.message || "Falha ao importar extrato.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ ...card({ padding: isCompact ? "16px 14px" : "20px 22px", marginBottom: 20, overflow: "hidden" }) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isCompact ? "stretch" : "center", marginBottom: 16, gap: 12, flexWrap: "wrap", flexDirection: isCompact ? "column" : "row" }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: isCompact ? 24 : 22, color: T }}>Finanças Mensais</h2>
            <p style={{ fontSize: 13, color: T3, marginTop: 6 }}>Micro gestão de despesas, alocações mensais e importação automática de extratos.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FINANCE_TABS.map((tab) => <TabButton key={tab.key} active={activeTab === tab.key} label={tab.label} onClick={() => setActiveTab(tab.key)} />)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "auto minmax(160px,180px) minmax(220px,280px)", gap: 10, alignItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 44px", gap: 8, alignItems: "center" }}>
            <button onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))} style={bsm({ padding: "10px 0" })}>←</button>
            <div style={{ background: S2, border: "1px solid " + BD2, borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: T3, marginBottom: 4 }}>Mês ativo</p>
              <p style={{ fontSize: 14, color: T, fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</p>
            </div>
            <button onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))} style={bsm({ padding: "10px 0" })}>→</button>
          </div>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...inp, width: "100%" }} />
          <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ ...inp, width: "100%" }}>
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
            <FinanceStat label="Entradas do mês" value={`CHF ${fmtF(totals.income)}`} note="Total de rendimentos registados" color={GR} compact={isCompact} />
            <FinanceStat label="Saídas do mês" value={`CHF ${fmtF(totals.expense)}`} note="Total de despesas registadas" color={RD} compact={isCompact} />
            <FinanceStat label="Saldo mensal" value={`CHF ${fmtF(totals.income - totals.expense)}`} note={selectedAccountId === "all" ? "Todas as contas" : accountNameById[selectedAccountId]} color={totals.income - totals.expense >= 0 ? G : RD} compact={isCompact} />
            <FinanceStat label="Categoria mais pesada" value={topExpenseCategory ? topExpenseCategory.name : "—"} note={topExpenseCategory ? `CHF ${fmtF(topExpenseCategory.amount)}` : "Sem despesas"} color={topExpenseCategory?.color || T} compact={isCompact} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1fr) minmax(300px,.9fr)", gap: 16, alignItems: "start", marginBottom: 20 }}>
            <div style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ONDE GASTASTE MAIS</p>
                  <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Distribuição de despesas no mês filtrado.</p>
                </div>
                <span style={{ fontSize: 11, color: T3 }}>{expensesByCategory.length} categoria(s)</span>
              </div>
              <ExpenseBreakdown rows={expensesByCategory} totalExpenses={totals.expense} />
            </div>

            <div style={card()}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>RESUMO RÁPIDO</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Leitura imediata do mês e da conta selecionada.</p>
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
          </div>
        </>
      )}

      {activeTab === "transactions" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1.1fr) minmax(320px,.9fr)", gap: 16, alignItems: "start", marginBottom: 20 }}>
            <div style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>NOVA TRANSAÇÃO</p>
                  <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Regista manualmente os movimentos do mês.</p>
                </div>
                <div style={{ display: "flex", gap: 6, width: isCompact ? "100%" : "auto" }}>
                  {[{ key: "expense", label: "Despesa", color: RD }, { key: "income", label: "Entrada", color: GR }].map((option) => (
                    <button key={option.key} onClick={() => setTransactionForm((prev) => ({ ...prev, kind: option.key }))} style={{ ...bsm({ padding: "9px 12px", flex: isCompact ? 1 : "unset" }), background: transactionForm.kind === option.key ? option.color : "transparent", color: transactionForm.kind === option.key ? "#111" : T2, border: "1px solid " + (transactionForm.kind === option.key ? option.color : BD2) }}>{option.label}</button>
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
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={transactionForm.notes} onChange={(e) => setTransactionForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observações opcionais" />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 8, flexWrap: "wrap" }}>
                <button style={{ ...btnG, width: isCompact ? "100%" : "auto" }} onClick={saveTransaction}>Adicionar transação</button>
              </div>
            </div>

            <div style={card()}>
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
                      <span>{item.kind === "income" ? "+" : "-"}CHF {fmtF(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button style={{ ...btnG, width: isCompact ? "100%" : "auto", opacity: uploading || !uploadFiles.length ? 0.55 : 1 }} onClick={importStatement} disabled={uploading || !uploadFiles.length}>{uploading ? "A ler extrato..." : "Importar via AI"}</button>
              </div>
            </div>
          </div>

          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>MOVIMENTOS DO MÊS</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>{monthTransactions.length} movimento(s) encontrados no filtro actual.</p>
              </div>
            </div>

            {monthTransactions.length === 0 ? (
              <p style={{ color: T3, fontSize: 13 }}>Ainda não existem movimentos registados para este mês.</p>
            ) : isCompact ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {monthTransactions.map((item) => <TransactionCard key={item.id} item={item} category={categoriesById[item.categoryId]} accountName={accountNameById[item.accountId]} categories={normalizedFinanceData.categories} bankAccounts={bankAccounts} isEditing={editingTransactionId === item.id} draft={editingDraft} onEdit={() => startInlineEdit(item)} onDraftChange={onInlineDraftChange} onSaveEdit={saveInlineEdit} onCancelEdit={cancelInlineEdit} onDelete={() => deleteTransaction(item.id)} />)}
              </div>
            ) : (
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
                    {monthTransactions.map((item) => {
                      const category = categoriesById[item.categoryId];
                      const color = category?.color || T2;
                      const isEditingRow = editingTransactionId === item.id;
                      const rowCategories = normalizedFinanceData.categories.filter((entry) => entry.kind === editingDraft.kind);
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid " + BD, background: isEditingRow ? BL + "10" : "transparent" }}>
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
                            {isEditingRow ? <input style={inp} type="number" step="0.01" value={editingDraft.amount} onChange={(e) => onInlineDraftChange("amount", e.target.value)} /> : `${item.kind === "income" ? "+" : "-"}CHF ${fmtF(item.amount)}`}
                          </td>
                          <td style={{ padding: "11px 8px" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                              {isEditingRow ? (
                                <>
                                  <button onClick={saveInlineEdit} style={bsm({ color: G, borderColor: G + "30" })}>Guardar</button>
                                  <button onClick={cancelInlineEdit} style={bsm({ color: T2, borderColor: BD2 })}>Cancelar</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startInlineEdit(item)} style={bsm({ color: BL, borderColor: BL + "30" })}>Editar</button>
                                  <button onClick={() => deleteTransaction(item.id)} style={bsm({ color: RD, borderColor: RD + "30" })}>×</button>
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
            )}
          </div>
        </>
      )}

      {activeTab === "planning" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1fr) minmax(300px,.9fr)", gap: 16, alignItems: "start", marginBottom: 20 }}>
            <div style={card()}>
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
                <button style={bsm({ padding: "10px 12px", color: G, borderColor: G + "30" })} onClick={addCategory}>Criar</button>
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

            <div style={card()}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ESTADO DAS ALOCAÇÕES</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Quanto do plano mensal já foi consumido.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {normalizedFinanceData.allocations.map((allocation) => {
                  const amount = allocationMap[allocation.id] || 0;
                  const target = totals.income * ((Number(allocation.percent) || 0) / 100);
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
          </div>

          <div style={{ ...card({ marginBottom: 20 }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 12, color: T2, fontWeight: 700, letterSpacing: 1 }}>ALOCAÇÕES MENSAIS</p>
                <p style={{ fontSize: 12, color: T3, marginTop: 4 }}>Define percentagens mensais e acompanha automaticamente a execução.</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: allocationPercentTotal === 100 ? GR : allocationPercentTotal > 100 ? RD : G }}>Total configurado: {allocationPercentTotal.toFixed(1)}%</span>
                <button style={bsm({ color: G, borderColor: G + "30" })} onClick={addAllocation}>+ Alocação</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {normalizedFinanceData.allocations.map((allocation) => (
                <AllocationCard key={allocation.id} allocation={allocation} incomeTotal={totals.income} actualAmount={allocationMap[allocation.id] || 0} categories={normalizedFinanceData.categories} compact={isCompact} onChange={(nextAllocation) => updateAllocation(allocation.id, nextAllocation)} onRemove={() => removeAllocation(allocation.id)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
