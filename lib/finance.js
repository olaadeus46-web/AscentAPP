const DEFAULT_FINANCE_CATEGORIES = [
  { id: "cat-income", name: "Renda", kind: "income", color: "#39d08f", system: true },
  { id: "cat-investments", name: "Investimentos", kind: "expense", color: "#f5c970", system: true },
  { id: "cat-housing", name: "Habitação", kind: "expense", color: "#e08855", system: true },
  { id: "cat-transport", name: "Transportes", kind: "expense", color: "#67b4ff", system: true },
  { id: "cat-utilities", name: "Luz", kind: "expense", color: "#ffb55f", system: true },
  { id: "cat-shopping", name: "Compras", kind: "expense", color: "#b38cff", system: true },
  { id: "cat-groceries", name: "Supermercado", kind: "expense", color: "#5fd2e6", system: true },
  { id: "cat-health", name: "Saúde", kind: "expense", color: "#ff6d7f", system: true },
  { id: "cat-leisure", name: "Lazer", kind: "expense", color: "#b0bddf", system: true },
];

const DEFAULT_FINANCE_ALLOCATIONS = [
  { id: "alloc-investments", name: "Investimentos", percent: 25, categoryIds: ["cat-investments"] },
  { id: "alloc-life", name: "Despesas da vida", percent: 70, categoryIds: ["cat-housing", "cat-transport", "cat-utilities", "cat-groceries", "cat-health"] },
  { id: "alloc-free", name: "Compras livres", percent: 5, categoryIds: ["cat-shopping", "cat-leisure"] },
];

function cloneArray(items) {
  return items.map((item) => ({ ...item }));
}

export function createDefaultFinanceData() {
  return {
    categories: cloneArray(DEFAULT_FINANCE_CATEGORIES),
    allocations: cloneArray(DEFAULT_FINANCE_ALLOCATIONS),
    transactions: [],
  };
}

export function normalizeFinanceData(financeData) {
  const defaults = createDefaultFinanceData();
  const source = financeData && typeof financeData === "object" ? financeData : {};

  const customCategories = Array.isArray(source.categories)
    ? source.categories.filter((item) => item && !DEFAULT_FINANCE_CATEGORIES.some((def) => def.id === item.id))
    : [];

  const categories = [
    ...DEFAULT_FINANCE_CATEGORIES.map((def) => {
      const existing = Array.isArray(source.categories) ? source.categories.find((item) => item?.id === def.id) : null;
      return { ...def, ...(existing || {}), system: true };
    }),
    ...customCategories
      .filter((item) => item?.id && item?.name)
      .map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind === "income" ? "income" : "expense",
        color: item.color || "#b0bddf",
        system: Boolean(item.system),
      })),
  ];

  const allocations = Array.isArray(source.allocations)
    ? source.allocations
        .filter((item) => item?.id && item?.name)
        .map((item) => ({
          id: item.id,
          name: item.name,
          percent: Number(item.percent) || 0,
          categoryIds: Array.isArray(item.categoryIds) ? item.categoryIds.filter(Boolean) : [],
        }))
    : defaults.allocations;

  const transactions = Array.isArray(source.transactions)
    ? source.transactions
        .filter((item) => item?.id)
        .map((item) => ({
          id: item.id,
          accountId: item.accountId || "",
          date: item.date || "",
          description: item.description || "",
          amount: Math.abs(Number(item.amount) || 0),
          kind: item.kind === "income" ? "income" : "expense",
          categoryId: item.categoryId || "",
          notes: item.notes || "",
          source: item.source || "manual",
          createdAt: item.createdAt || null,
        }))
    : [];

  return { categories, allocations, transactions };
}

export function monthKeyFromDate(dateString) {
  return String(dateString || "").slice(0, 7);
}

export function getMonthlyAccountBalances(financeData, monthKey = new Date().toISOString().slice(0, 7)) {
  return normalizeFinanceData(financeData).transactions.reduce((acc, item) => {
    if (!item?.accountId || monthKeyFromDate(item.date) !== monthKey) return acc;

    const accountId = String(item.accountId);
    const delta = item.kind === "income" ? item.amount : -item.amount;
    acc[accountId] = (acc[accountId] || 0) + delta;
    return acc;
  }, {});
}

export function buildTransactionFingerprint(item) {
  return [
    item.accountId || "",
    item.date || "",
    String(Number(item.amount) || 0),
    item.kind || "expense",
    String(item.description || "").trim().toLowerCase(),
  ].join("|");
}

export function findCategoryByName(categories, name, kind) {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (!normalizedName) return null;

  return (categories || []).find((item) => {
    return String(item?.name || "").trim().toLowerCase() === normalizedName && (!kind || item.kind === kind);
  }) || null;
}
