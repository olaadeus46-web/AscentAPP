import { useCallback, useEffect, useMemo, useState } from "react";
import {
  G,
  BL,
  GR,
  RD,
  T,
  T2,
  T3,
  BD2,
  CURRENCIES,
  card,
  bsm,
  btn,
  btnG,
  inp,
  lbl,
  Modal,
} from "./shared";

function fmtMoney(value) {
  return (Number(value) || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erro na API.");
  }
  return data;
}

function normalizeName(user, fallback = "Utilizador") {
  return user?.name || user?.email || fallback;
}

function createExpenseItem(partial = {}) {
  return {
    id: `expense-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    description: partial.description || "",
    amount: partial.amount ? String(partial.amount) : "",
    currency: partial.currency || "CHF",
    expenseDate: partial.expenseDate || new Date().toISOString().slice(0, 10),
    note: partial.note || "",
  };
}

function buildEqualPercentageMap(memberIds) {
  const percentMap = {};
  const equalPercent = memberIds.length ? 100 / memberIds.length : 0;
  memberIds.forEach((id) => {
    percentMap[id] = Number(equalPercent.toFixed(2));
  });
  return percentMap;
}

export default function TricountSection({ prefillExpenseRequest, onConsumePrefillExpense, currentUserId = null }) {
  const [overview, setOverview] = useState({ groups: [], pendingInvites: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [inviteForm, setInviteForm] = useState({
    groupName: "",
    email: "",
    baseCurrency: "CHF",
  });

  const [expenseForm, setExpenseForm] = useState({
    paidByUserId: "",
    splitMode: "equal",
  });
  const [expenseItems, setExpenseItems] = useState([createExpenseItem()]);
  const [participantIds, setParticipantIds] = useState([]);
  const [manualShares, setManualShares] = useState({});
  const [percentageShares, setPercentageShares] = useState({});

  const [settlementForm, setSettlementForm] = useState({
    fromUserId: "",
    toUserId: "",
    amount: "",
    currency: "CHF",
    note: "",
    settledAt: new Date().toISOString().slice(0, 10),
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [pendingDeleteExpenseId, setPendingDeleteExpenseId] = useState(null);
  const [expenseHistoryPage, setExpenseHistoryPage] = useState(1);
  const [expenseHistoryFilters, setExpenseHistoryFilters] = useState({
    search: "",
    payerUserId: "all",
    splitMode: "all",
    dateFrom: "",
    dateTo: "",
  });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson("/api/shared/overview");
      const data = response.data || { groups: [], pendingInvites: [] };
      setOverview(data);
      setSelectedGroupId((prev) => {
        if (prev && data.groups.some((group) => Number(group.id) === Number(prev))) {
          return prev;
        }
        return data.groups[0]?.id || null;
      });
    } catch (err) {
      setError(err.message || "Não foi possível carregar os dados partilhados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const currentGroup = useMemo(() => (
    overview.groups.find((group) => Number(group.id) === Number(selectedGroupId)) || null
  ), [overview.groups, selectedGroupId]);

  const expensesPerPage = 8;
  const expenseHistory = currentGroup?.expenses || [];
  const filteredExpenseHistory = useMemo(() => {
    const searchTerm = String(expenseHistoryFilters.search || "").trim().toLowerCase();

    return expenseHistory.filter((expense) => {
      if (expenseHistoryFilters.payerUserId !== "all" && String(expense.paid_by_user_id) !== String(expenseHistoryFilters.payerUserId)) {
        return false;
      }

      if (expenseHistoryFilters.splitMode !== "all" && String(expense.split_mode || "") !== String(expenseHistoryFilters.splitMode)) {
        return false;
      }

      if (expenseHistoryFilters.dateFrom && String(expense.expense_date || "") < expenseHistoryFilters.dateFrom) {
        return false;
      }

      if (expenseHistoryFilters.dateTo && String(expense.expense_date || "") > expenseHistoryFilters.dateTo) {
        return false;
      }

      if (!searchTerm) return true;

      const payerName = normalizeName(expense.payer, "Membro");
      const description = String(expense.description || "");
      const currency = String(expense.currency || "");

      return `${description} ${payerName} ${currency}`.toLowerCase().includes(searchTerm);
    });
  }, [expenseHistory, expenseHistoryFilters]);
  const expenseHistoryPageCount = Math.max(1, Math.ceil(filteredExpenseHistory.length / expensesPerPage));
  const currentExpenseHistoryPage = Math.min(Math.max(expenseHistoryPage, 1), expenseHistoryPageCount);
  const paginatedExpenseHistory = useMemo(() => {
    const start = (currentExpenseHistoryPage - 1) * expensesPerPage;
    return filteredExpenseHistory.slice(start, start + expensesPerPage);
  }, [filteredExpenseHistory, currentExpenseHistoryPage]);

  const members = currentGroup?.members || [];
  const preferredPayerUserId = useMemo(() => {
    const matchedMember = members.find((member) => Number(member.user_id) === Number(currentUserId));
    return matchedMember ? String(matchedMember.user_id) : null;
  }, [members, currentUserId]);

  useEffect(() => {
    if (!currentGroup) return;
    const allMemberIds = members.map((member) => Number(member.user_id));
    setParticipantIds(allMemberIds);
    setExpenseForm((prev) => ({
      ...prev,
      paidByUserId: String(prev.paidByUserId || preferredPayerUserId || allMemberIds[0] || ""),
    }));
    setExpenseItems((prev) => prev.map((item) => ({
      ...item,
      currency: item.currency || currentGroup.base_currency || "CHF",
    })));
    setSettlementForm((prev) => ({
      ...prev,
      fromUserId: String(prev.fromUserId || allMemberIds[0] || ""),
      toUserId: String(prev.toUserId || allMemberIds[1] || allMemberIds[0] || ""),
      currency: currentGroup.base_currency || "CHF",
    }));

    setPercentageShares(buildEqualPercentageMap(allMemberIds));
  }, [currentGroup, members, preferredPayerUserId]);

  useEffect(() => {
    if (!prefillExpenseRequest?.requestId || loading) return;

    if (!overview.groups.length) {
      setError("Não tens divisões disponíveis. Cria uma divisão para adicionar esta despesa partilhada.");
      setShowInviteModal(true);
      onConsumePrefillExpense?.();
      return;
    }

    const targetGroup = overview.groups.find((group) => Number(group.id) === Number(selectedGroupId)) || overview.groups[0];
    const targetMemberIds = (targetGroup?.members || []).map((member) => Number(member.user_id));
    const prefillMovements = Array.isArray(prefillExpenseRequest.movements)
      ? prefillExpenseRequest.movements
      : [prefillExpenseRequest];
    const nextItems = prefillMovements
      .filter(Boolean)
      .map((movement) => createExpenseItem({
        description: movement.description || "Despesa partilhada",
        amount: movement.amount ? String(movement.amount) : "",
        currency: movement.currency || targetGroup?.base_currency || "CHF",
        expenseDate: movement.expenseDate || new Date().toISOString().slice(0, 10),
        note: movement.note || "",
      }));

    setSelectedGroupId(targetGroup?.id || null);
    setParticipantIds(targetMemberIds);
    setPercentageShares(buildEqualPercentageMap(targetMemberIds));
    setManualShares({});
    setExpenseForm((prev) => ({
      ...prev,
      paidByUserId: String(preferredPayerUserId || targetMemberIds[0] || prev.paidByUserId || ""),
      splitMode: "equal",
    }));
    setExpenseItems(nextItems.length ? nextItems : [createExpenseItem({ currency: targetGroup?.base_currency || "CHF" })]);
    setShowExpenseModal(true);
    setError("");
    onConsumePrefillExpense?.();
  }, [prefillExpenseRequest, overview.groups, selectedGroupId, loading, onConsumePrefillExpense, preferredPayerUserId]);

  useEffect(() => {
    setExpenseHistoryPage(1);
  }, [selectedGroupId]);

  useEffect(() => {
    setExpenseHistoryPage(1);
  }, [expenseHistoryFilters]);

  useEffect(() => {
    if (expenseHistoryPage !== currentExpenseHistoryPage) {
      setExpenseHistoryPage(currentExpenseHistoryPage);
    }
  }, [expenseHistoryPage, currentExpenseHistoryPage]);

  const openExpenseModal = () => {
    if (!currentGroup) return;
    const allMemberIds = members.map((member) => Number(member.user_id));
    setParticipantIds(allMemberIds);
    setPercentageShares(buildEqualPercentageMap(allMemberIds));
    setManualShares({});
    setExpenseForm((prev) => ({
      ...prev,
      paidByUserId: String(preferredPayerUserId || allMemberIds[0] || prev.paidByUserId || ""),
      splitMode: "equal",
    }));
    setExpenseItems([createExpenseItem({ currency: currentGroup.base_currency || "CHF" })]);
    setShowExpenseModal(true);
  };

  const userById = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.user_id] = member.user;
    });
    return map;
  }, [members]);

  const withBusy = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await loadOverview();
    } catch (err) {
      setError(err.message || "Ocorreu um erro.");
    } finally {
      setBusy(false);
    }
  };

  const toggleParticipant = (userId) => {
    setParticipantIds((prev) => {
      const has = prev.includes(userId);
      if (has) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  };

  const addExpenseItem = () => {
    setExpenseItems((prev) => [...prev, createExpenseItem({ currency: currentGroup?.base_currency || "CHF" })]);
  };

  const removeExpenseItem = (itemId) => {
    setExpenseItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const updateExpenseItem = (itemId, field, value) => {
    setExpenseItems((prev) => prev.map((item) => (
      item.id === itemId ? { ...item, [field]: value } : item
    )));
  };

  const submitInvite = async () => {
    if (!inviteForm.email.trim()) {
      setError("Indica o email do utilizador a convidar.");
      return;
    }

    await withBusy(async () => {
      await apiJson("/api/shared/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      setInviteForm({ groupName: "", email: "", baseCurrency: inviteForm.baseCurrency || "CHF" });
    });
  };

  const respondInvite = async (inviteId, action) => {
    await withBusy(async () => {
      await apiJson("/api/shared/invite-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action }),
      });
    });
  };

  const submitExpense = async () => {
    if (!currentGroup) return;

    const normalizedItems = expenseItems
      .map((item) => ({
        description: String(item.description || "").trim(),
        amount: Number(String(item.amount).replace(",", ".")),
        currency: item.currency || currentGroup.base_currency || "CHF",
        expenseDate: item.expenseDate || new Date().toISOString().slice(0, 10),
      }))
      .filter((item) => item.description || item.amount > 0);

    if (!normalizedItems.length) {
      setError("Adiciona pelo menos uma despesa válida para guardar.");
      return;
    }

    if (normalizedItems.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
      setError("Todas as despesas devem ter um valor superior a zero.");
      return;
    }

    await withBusy(async () => {
      for (const item of normalizedItems) {
        await apiJson("/api/shared/expense", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: currentGroup.id,
            description: item.description,
            amount: item.amount,
            currency: item.currency,
            paidByUserId: Number(expenseForm.paidByUserId),
            splitMode: expenseForm.splitMode,
            participantIds,
            percentageShares,
            manualShares,
            expenseDate: item.expenseDate,
          }),
        });
      }
      setExpenseItems([createExpenseItem({ currency: currentGroup.base_currency || "CHF" })]);
      setShowExpenseModal(false);
    });
  };

  const submitSettlement = async () => {
    if (!currentGroup) return;

    await withBusy(async () => {
      await apiJson("/api/shared/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: currentGroup.id,
          fromUserId: Number(settlementForm.fromUserId),
          toUserId: Number(settlementForm.toUserId),
          amount: Number(String(settlementForm.amount).replace(",", ".")),
          currency: settlementForm.currency,
          note: settlementForm.note,
          settledAt: settlementForm.settledAt,
        }),
      });
      setSettlementForm((prev) => ({ ...prev, amount: "", note: "" }));
    });
  };

  const deleteExpense = async (expenseId) => {
    if (!expenseId) return;

    await withBusy(async () => {
      await apiJson("/api/shared/expense", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId }),
      });
      setPendingDeleteExpenseId(null);
    });
  };

  if (loading) {
    return <div style={{ color: T2, fontSize: 14 }}>A carregar Tricount...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T }}>Contas Partilhadas</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={bsm({ color: G, borderColor: G + "45" })} onClick={() => setShowInviteModal(true)}>+ Divisão</button>
        </div>
      </div>

      {error && <p style={{ color: RD, fontSize: 12 }}>{error}</p>}

      {overview.pendingInvites.length > 0 && (
        <div style={{ ...card(), padding: "16px" }}>
          <h3 style={{ color: T, fontSize: 16, marginBottom: 12 }}>Pedidos recebidos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {overview.pendingInvites.map((invite) => (
              <div key={invite.id} style={{ border: "1px solid " + BD2, borderRadius: 12, padding: "10px 12px" }}>
                <p style={{ color: T, fontSize: 13 }}>
                  {normalizeName(invite.inviter, "Utilizador")} convidou-te para <strong>{invite.group?.name || "Divisão conjunta"}</strong>
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button disabled={busy} style={{ ...bsm({ color: GR, borderColor: GR + "45" }) }} onClick={() => respondInvite(invite.id, "accept")}>Aceitar</button>
                  <button disabled={busy} style={{ ...bsm({ color: RD, borderColor: RD + "40" }) }} onClick={() => respondInvite(invite.id, "reject")}>Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card(), padding: "16px" }}>
        <h3 style={{ color: T, fontSize: 16, marginBottom: 10 }}>As tuas divisões</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {overview.groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              style={{
                border: "1px solid " + (Number(selectedGroupId) === Number(group.id) ? G + "55" : BD2),
                borderRadius: 14,
                background: Number(selectedGroupId) === Number(group.id) ? G + "18" : "rgba(255,255,255,.02)",
                color: T,
                textAlign: "left",
                padding: "12px 14px",
                cursor: "pointer",
                transition: "all .2s ease",
              }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: Number(selectedGroupId) === Number(group.id) ? G : T }}>
                {group.name}
              </p>
              <p style={{ fontSize: 12, color: T2, marginTop: 4 }}>
                {group.members?.length || 0} membros · {(group.expenses || []).length} despesas
              </p>
              <p style={{ fontSize: 11, color: T3, marginTop: 6 }}>
                {group.base_currency} · {(group.balance?.transfers || []).length} liquidações sugeridas
              </p>
            </button>
          ))}
          {overview.groups.length === 0 && <p style={{ color: T3, fontSize: 12 }}>Ainda não tens divisões criadas.</p>}
        </div>
      </div>

      {currentGroup && (
        <>
          <div style={{ ...card(), padding: "16px" }}>
            <h3 style={{ color: T, fontSize: 16, marginBottom: 10 }}>
              Balanço em tempo real ({currentGroup.base_currency}) · {currentGroup.name}
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button style={btnG} onClick={openExpenseModal}>Adicionar despesa</button>
              <button style={{ ...btn({ borderColor: BL + "35", color: BL }) }} onClick={() => setShowSettlementModal(true)}>Liquidar dívida</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              {Object.entries(currentGroup.balance?.balanceByUserId || {}).map(([userId, amount]) => {
                const value = Number(amount) || 0;
                return (
                  <div key={userId} style={{ border: "1px solid " + BD2, borderRadius: 12, padding: "10px" }}>
                    <p style={{ color: T2, fontSize: 12 }}>{normalizeName(userById[userId], "Membro")}</p>
                    <p style={{ color: value >= 0 ? GR : RD, fontWeight: 700, marginTop: 4 }}>
                      {value >= 0 ? "Tem a receber" : "Deve"} {fmtMoney(Math.abs(value))} {currentGroup.base_currency}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...card(), padding: "16px" }}>
            <h3 style={{ color: T, fontSize: 16, marginBottom: 10 }}>Histórico de despesas</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 10 }}>
              <div>
                <span style={lbl}>Pesquisar</span>
                <input
                  style={inp}
                  value={expenseHistoryFilters.search}
                  onChange={(event) => setExpenseHistoryFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Descrição ou pagador"
                />
              </div>
              <div>
                <span style={lbl}>Pagador</span>
                <select
                  style={inp}
                  value={expenseHistoryFilters.payerUserId}
                  onChange={(event) => setExpenseHistoryFilters((prev) => ({ ...prev, payerUserId: event.target.value }))}>
                  <option value="all">Todos</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={String(member.user_id)}>{normalizeName(member.user, "Membro")}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={lbl}>Divisão</span>
                <select
                  style={inp}
                  value={expenseHistoryFilters.splitMode}
                  onChange={(event) => setExpenseHistoryFilters((prev) => ({ ...prev, splitMode: event.target.value }))}>
                  <option value="all">Todas</option>
                  <option value="equal">Igual</option>
                  <option value="percentage">Percentagem</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div>
                <span style={lbl}>Data início</span>
                <input
                  style={inp}
                  type="date"
                  value={expenseHistoryFilters.dateFrom}
                  onChange={(event) => setExpenseHistoryFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                />
              </div>
              <div>
                <span style={lbl}>Data fim</span>
                <input
                  style={inp}
                  type="date"
                  value={expenseHistoryFilters.dateTo}
                  onChange={(event) => setExpenseHistoryFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  style={{ ...bsm({ width: "100%", color: T2, borderColor: BD2 }) }}
                  onClick={() => setExpenseHistoryFilters({ search: "", payerUserId: "all", splitMode: "all", dateFrom: "", dateTo: "" })}>
                  Limpar
                </button>
              </div>
            </div>
            {expenseHistory.length === 0 && <p style={{ color: T3, fontSize: 13 }}>Ainda não há despesas neste grupo.</p>}
            {expenseHistory.length > 0 && filteredExpenseHistory.length === 0 && <p style={{ color: T3, fontSize: 13 }}>Nenhuma despesa corresponde aos filtros atuais.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {paginatedExpenseHistory.map((expense) => (
                <div key={expense.id} style={{ border: "1px solid " + BD2, borderRadius: 12, padding: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <p style={{ color: T, fontSize: 13, fontWeight: 600 }}>{expense.description}</p>
                    <button
                      disabled={busy}
                      onClick={() => setPendingDeleteExpenseId(expense.id)}
                      style={bsm({ color: RD, borderColor: RD + "40" })}>
                      Apagar
                    </button>
                  </div>
                  <p style={{ color: T2, fontSize: 12, marginTop: 4 }}>
                    {fmtMoney(expense.amount)} {expense.currency} · pagou {normalizeName(expense.payer, "Membro")} · {expense.expense_date}
                  </p>
                  <p style={{ color: T3, fontSize: 11, marginTop: 6 }}>Divisão {expense.split_mode}:</p>
                  <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(expense.shares || []).map((share) => (
                      <span key={share.user_id} style={{ fontSize: 11, color: T2, border: "1px solid " + BD2, borderRadius: 999, padding: "3px 8px" }}>
                        {normalizeName(userById[share.user_id], "Membro")} {fmtMoney(share.share_amount)} {expense.currency}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {filteredExpenseHistory.length > expensesPerPage && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <p style={{ color: T3, fontSize: 12 }}>
                  Página {currentExpenseHistoryPage} de {expenseHistoryPageCount} · {filteredExpenseHistory.length} filtrada(s) de {expenseHistory.length}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={currentExpenseHistoryPage <= 1}
                    onClick={() => setExpenseHistoryPage((prev) => Math.max(1, prev - 1))}
                    style={bsm({ color: T2, borderColor: BD2, opacity: currentExpenseHistoryPage <= 1 ? 0.55 : 1 })}>
                    Anterior
                  </button>
                  <button
                    disabled={currentExpenseHistoryPage >= expenseHistoryPageCount}
                    onClick={() => setExpenseHistoryPage((prev) => Math.min(expenseHistoryPageCount, prev + 1))}
                    style={bsm({ color: G, borderColor: G + "40", opacity: currentExpenseHistoryPage >= expenseHistoryPageCount ? 0.55 : 1 })}>
                    Seguinte
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...card(), padding: "16px" }}>
            <h3 style={{ color: T, fontSize: 16, marginBottom: 10 }}>Simplificação de dívidas</h3>
            {(currentGroup.balance?.transfers || []).length === 0 && (
              <p style={{ color: T3, fontSize: 13 }}>Sem transferências pendentes. Tudo equilibrado.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(currentGroup.balance?.transfers || []).map((transfer, index) => (
                <div key={index} style={{ border: "1px solid " + BD2, borderRadius: 12, padding: "10px" }}>
                  <p style={{ color: T, fontSize: 13 }}>
                    {normalizeName(userById[transfer.fromUserId], "A")}
                    <span style={{ color: T3 }}> → </span>
                    {normalizeName(userById[transfer.toUserId], "B")}
                    <span style={{ color: BL, fontWeight: 700 }}> {fmtMoney(transfer.amount)} {currentGroup.base_currency}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showInviteModal && (
        <Modal title="Criar divisão e convidar" onClose={() => setShowInviteModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div>
              <span style={lbl}>Nome da divisão</span>
              <input style={inp} value={inviteForm.groupName} onChange={(event) => setInviteForm((prev) => ({ ...prev, groupName: event.target.value }))} placeholder="ex: Casa Porto" />
            </div>
            <div>
              <span style={lbl}>Email convidado</span>
              <input style={inp} type="email" value={inviteForm.email} onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="amigo@email.com" />
            </div>
            <div>
              <span style={lbl}>Moeda base</span>
              <select style={inp} value={inviteForm.baseCurrency} onChange={(event) => setInviteForm((prev) => ({ ...prev, baseCurrency: event.target.value }))}>
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </div>
          </div>
          <button disabled={busy} style={{ ...btnG, marginTop: 14 }} onClick={submitInvite}>Enviar convite</button>
        </Modal>
      )}

      {showExpenseModal && currentGroup && (
        <Modal title={`Adicionar despesa · ${currentGroup.name}`} onClose={() => setShowExpenseModal(false)} wide>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <p style={{ color: T2, fontSize: 12 }}>{expenseItems.length} movimento(s) preparado(s) para partilha</p>
            <button disabled={busy} style={bsm({ color: G, borderColor: G + "45" })} onClick={addExpenseItem}>+ Movimento</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {expenseItems.map((expenseItem, index) => (
              <div key={expenseItem.id} style={{ border: "1px solid " + BD2, borderRadius: 12, padding: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <p style={{ color: T, fontSize: 12, fontWeight: 600 }}>Movimento {index + 1}</p>
                  <button
                    disabled={busy || expenseItems.length <= 1}
                    onClick={() => removeExpenseItem(expenseItem.id)}
                    style={bsm({ color: RD, borderColor: RD + "40", opacity: expenseItems.length > 1 ? 1 : 0.55 })}>
                    Remover
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                  <div>
                    <span style={lbl}>Descrição</span>
                    <input style={inp} value={expenseItem.description} onChange={(event) => updateExpenseItem(expenseItem.id, "description", event.target.value)} placeholder="Jantar, supermercado..." />
                  </div>
                  <div>
                    <span style={lbl}>Valor</span>
                    <input style={inp} type="number" min="0" step="0.01" value={expenseItem.amount} onChange={(event) => updateExpenseItem(expenseItem.id, "amount", event.target.value)} />
                  </div>
                  <div>
                    <span style={lbl}>Moeda</span>
                    <select style={inp} value={expenseItem.currency} onChange={(event) => updateExpenseItem(expenseItem.id, "currency", event.target.value)}>
                      {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>Data</span>
                    <input style={inp} type="date" value={expenseItem.expenseDate} onChange={(event) => updateExpenseItem(expenseItem.id, "expenseDate", event.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 10 }}>
            <div>
              <span style={lbl}>Quem pagou</span>
              <select style={inp} value={expenseForm.paidByUserId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, paidByUserId: event.target.value }))}>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{normalizeName(member.user, "Membro")}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Tipo de divisão</span>
              <select style={inp} value={expenseForm.splitMode} onChange={(event) => setExpenseForm((prev) => ({ ...prev, splitMode: event.target.value }))}>
                <option value="equal">Igual</option>
                <option value="percentage">Percentagem</option>
                <option value="manual">Valor manual</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <span style={lbl}>Quem divide esta despesa</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {members.map((member) => {
                const selected = participantIds.includes(Number(member.user_id));
                return (
                  <button
                    key={member.user_id}
                    onClick={() => toggleParticipant(Number(member.user_id))}
                    style={{
                      ...bsm(),
                      borderColor: selected ? G : BD2,
                      color: selected ? G : T2,
                      background: selected ? G + "1c" : "transparent",
                    }}>
                    {normalizeName(member.user, "Membro")}
                  </button>
                );
              })}
            </div>
          </div>

          {expenseForm.splitMode === "percentage" && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 8 }}>
              {participantIds.map((userId) => (
                <div key={userId}>
                  <span style={lbl}>{normalizeName(userById[userId], "Membro")} (%)</span>
                  <input
                    style={inp}
                    type="number"
                    min="0"
                    step="0.01"
                    value={percentageShares[userId] ?? ""}
                    onChange={(event) => setPercentageShares((prev) => ({ ...prev, [userId]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {expenseForm.splitMode === "manual" && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 8 }}>
              {participantIds.map((userId) => (
                <div key={userId}>
                  <span style={lbl}>{normalizeName(userById[userId], "Membro")}</span>
                  <input
                    style={inp}
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualShares[userId] ?? ""}
                    onChange={(event) => setManualShares((prev) => ({ ...prev, [userId]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <button disabled={busy} style={{ ...btnG, marginTop: 14 }} onClick={submitExpense}>
            {expenseItems.length > 1 ? `Guardar ${expenseItems.length} despesas` : "Guardar despesa"}
          </button>
        </Modal>
      )}

      {showSettlementModal && currentGroup && (
        <Modal title={`Liquidar dívida · ${currentGroup.name}`} onClose={() => setShowSettlementModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            <div>
              <span style={lbl}>De</span>
              <select style={inp} value={settlementForm.fromUserId} onChange={(event) => setSettlementForm((prev) => ({ ...prev, fromUserId: event.target.value }))}>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{normalizeName(member.user, "Membro")}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Para</span>
              <select style={inp} value={settlementForm.toUserId} onChange={(event) => setSettlementForm((prev) => ({ ...prev, toUserId: event.target.value }))}>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{normalizeName(member.user, "Membro")}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Valor</span>
              <input style={inp} type="number" min="0" step="0.01" value={settlementForm.amount} onChange={(event) => setSettlementForm((prev) => ({ ...prev, amount: event.target.value }))} />
            </div>
            <div>
              <span style={lbl}>Moeda</span>
              <select style={inp} value={settlementForm.currency} onChange={(event) => setSettlementForm((prev) => ({ ...prev, currency: event.target.value }))}>
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Data</span>
              <input style={inp} type="date" value={settlementForm.settledAt} onChange={(event) => setSettlementForm((prev) => ({ ...prev, settledAt: event.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <span style={lbl}>Nota</span>
            <input style={inp} value={settlementForm.note} onChange={(event) => setSettlementForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="ex: MB Way" />
          </div>
          <button disabled={busy} style={{ ...btn({ marginTop: 14, borderColor: BL + "35", color: BL }) }} onClick={submitSettlement}>Marcar liquidação</button>
        </Modal>
      )}

      {pendingDeleteExpenseId && (
        <Modal title="Confirmar eliminação" onClose={() => setPendingDeleteExpenseId(null)}>
          <p style={{ color: T2, fontSize: 13, lineHeight: 1.5 }}>
            Queres apagar esta despesa do histórico?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={bsm()} onClick={() => setPendingDeleteExpenseId(null)}>Cancelar</button>
            <button
              disabled={busy}
              style={bsm({ color: RD, borderColor: RD + "40" })}
              onClick={() => deleteExpense(pendingDeleteExpenseId)}>
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
