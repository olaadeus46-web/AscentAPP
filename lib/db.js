import { createClient } from "@supabase/supabase-js";
import { createDefaultFinanceData, normalizeFinanceData } from "./finance";

const globalDb = globalThis;

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || "";
}

function getSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

export function getDb() {
  if (!globalDb.__rotaDb) {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();

    if (!url || !key) {
      throw new Error(
        "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY)."
      );
    }

    globalDb.__rotaDb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return globalDb.__rotaDb;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function countUsers() {
  const db = getDb();
  const { count, error } = await db
    .from("users")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function findUserByEmail(email) {
  const db = getDb();
  const { data, error } = await db
    .from("users")
    .select("id, name, email, password_hash, created_at")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findUserById(id) {
  const db = getDb();
  const { data, error } = await db
    .from("users")
    .select("id, name, email, password_hash, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createUser({ name, email, passwordHash }) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await db
    .from("users")
    .insert({
      name: String(name || "").trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, email, password_hash, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined) return fallback;

  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }

  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function isMissingFinanceDataColumn(error) {
  return Boolean(
    error?.code === "PGRST204" &&
    String(error?.message || "").includes("finance_data")
  );
}

function buildUserDataRow(userId, payload, includeFinanceData = true) {
  const row = {
    user_id: userId,
    portfolios: payload.portfolios || [],
    ideas: payload.ideas || [],
    goals: payload.goals || [],
    calendar_slots: payload.calendarSlots || [],
    nw_snapshots: payload.nwHistory || [],
    start_date: payload.startDate || null,
    base_currency: payload.baseCurrency || "CHF",
    updated_at: new Date().toISOString(),
  };

  if (includeFinanceData) {
    row.finance_data = normalizeFinanceData(payload.financeData);
  }

  return row;
}

export function getDefaultUserData() {
  return {
    portfolios: [],
    ideas: [],
    goals: [],
    calendarSlots: [],
    nwHistory: [],
    startDate: null,
    baseCurrency: "CHF",
    financeData: createDefaultFinanceData(),
  };
}

export async function getUserData(userId) {
  const db = getDb();
  const defaults = getDefaultUserData();

  let { error: upsertError } = await db
    .from("user_data")
    .upsert(buildUserDataRow(userId, defaults, true), { onConflict: "user_id", ignoreDuplicates: true });

  if (isMissingFinanceDataColumn(upsertError)) {
    ({ error: upsertError } = await db
      .from("user_data")
      .upsert(buildUserDataRow(userId, defaults, false), { onConflict: "user_id", ignoreDuplicates: true }));
  }

  if (upsertError) {
    throw upsertError;
  }

  const { data: row, error } = await db.from("user_data").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    throw error;
  }

  if (!row) return getDefaultUserData();

  return {
    portfolios: parseJsonField(row.portfolios, []),
    ideas: parseJsonField(row.ideas, []),
    goals: parseJsonField(row.goals, []),
    calendarSlots: parseJsonField(row.calendar_slots, []),
    nwHistory: parseJsonField(row.nw_snapshots, []),
    financeData: normalizeFinanceData(parseJsonField(row.finance_data, createDefaultFinanceData())),
    startDate: row.start_date || null,
    baseCurrency: row.base_currency || "CHF",
  };
}

export async function saveUserData(userId, data) {
  const db = getDb();
  const payload = {
    ...getDefaultUserData(),
    ...(data || {}),
  };

  let { error } = await db
    .from("user_data")
    .upsert(buildUserDataRow(userId, payload, true), { onConflict: "user_id" });

  if (isMissingFinanceDataColumn(error)) {
    ({ error } = await db
      .from("user_data")
      .upsert(buildUserDataRow(userId, payload, false), { onConflict: "user_id" }));
  }

  if (error) {
    throw error;
  }

  return getUserData(userId);
}

const FX_TO_CHF = {
  CHF: 1,
  EUR: 0.94,
  USD: 0.89,
  GBP: 1.13,
};

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function convertCurrency(value, fromCurrency, toCurrency) {
  const from = String(fromCurrency || "CHF").toUpperCase();
  const to = String(toCurrency || "CHF").toUpperCase();
  const amount = Number(value) || 0;
  if (from === to) return amount;

  const fromRate = FX_TO_CHF[from] || 1;
  const toRate = FX_TO_CHF[to] || 1;
  const valueInChf = amount * fromRate;
  return valueInChf / toRate;
}

function ensureValidSplitMode(splitMode) {
  if (["equal", "percentage", "manual"].includes(splitMode)) return splitMode;
  return "equal";
}

function uniqueNumberIds(values) {
  return [...new Set((values || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
}

function calculateSplitShares({ amount, splitMode, participantIds, percentageShares, manualShares }) {
  const amountTotal = Number(amount) || 0;
  const participants = uniqueNumberIds(participantIds);
  if (!participants.length) {
    throw new Error("Selecione pelo menos um participante para dividir a despesa.");
  }

  const shares = [];
  if (splitMode === "equal") {
    const equalValue = amountTotal / participants.length;
    participants.forEach((userId, index) => {
      if (index === participants.length - 1) {
        const used = shares.reduce((sum, item) => sum + item.shareAmount, 0);
        shares.push({ userId, shareAmount: roundMoney(amountTotal - used), sharePercentage: null });
      } else {
        shares.push({ userId, shareAmount: roundMoney(equalValue), sharePercentage: null });
      }
    });
    return shares;
  }

  if (splitMode === "percentage") {
    const map = percentageShares || {};
    const percentages = participants.map((userId) => Number(map[userId]) || 0);
    const totalPercentage = percentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalPercentage - 100) > 0.2) {
      throw new Error("A divisão por percentagem tem de totalizar 100%.");
    }

    participants.forEach((userId, index) => {
      const percentage = Number(map[userId]) || 0;
      if (index === participants.length - 1) {
        const used = shares.reduce((sum, item) => sum + item.shareAmount, 0);
        shares.push({ userId, shareAmount: roundMoney(amountTotal - used), sharePercentage: roundMoney(percentage) });
      } else {
        shares.push({ userId, shareAmount: roundMoney((amountTotal * percentage) / 100), sharePercentage: roundMoney(percentage) });
      }
    });
    return shares;
  }

  const map = manualShares || {};
  participants.forEach((userId, index) => {
    if (index === participants.length - 1) {
      const used = shares.reduce((sum, item) => sum + item.shareAmount, 0);
      shares.push({ userId, shareAmount: roundMoney(amountTotal - used), sharePercentage: null });
    } else {
      shares.push({ userId, shareAmount: roundMoney(Number(map[userId]) || 0), sharePercentage: null });
    }
  });

  const totalManual = roundMoney(shares.reduce((sum, item) => sum + item.shareAmount, 0));
  if (Math.abs(totalManual - amountTotal) > 0.05) {
    throw new Error("A divisão manual deve somar o valor total da despesa.");
  }

  return shares;
}

function buildSimplifiedTransfers(balanceByUserId) {
  const debtors = [];
  const creditors = [];

  Object.entries(balanceByUserId).forEach(([userId, amount]) => {
    const value = roundMoney(amount);
    if (value < -0.01) debtors.push({ userId: Number(userId), amount: Math.abs(value) });
    if (value > 0.01) creditors.push({ userId: Number(userId), amount: value });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const transferAmount = roundMoney(Math.min(debtor.amount, creditor.amount));

    if (transferAmount > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: transferAmount,
      });
    }

    debtor.amount = roundMoney(debtor.amount - transferAmount);
    creditor.amount = roundMoney(creditor.amount - transferAmount);

    if (debtor.amount <= 0.01) debtorIndex += 1;
    if (creditor.amount <= 0.01) creditorIndex += 1;
  }

  return transfers;
}

function computeGroupBalance({ members, expenses, shares, settlements }) {
  const memberIds = uniqueNumberIds((members || []).map((member) => member.user_id));
  const balanceByUserId = memberIds.reduce((acc, userId) => {
    acc[userId] = 0;
    return acc;
  }, {});

  const sharesByExpense = (shares || []).reduce((acc, share) => {
    const expenseId = Number(share.expense_id);
    if (!acc[expenseId]) acc[expenseId] = [];
    acc[expenseId].push(share);
    return acc;
  }, {});

  (expenses || []).forEach((expense) => {
    const payerId = Number(expense.paid_by_user_id);
    const amountBase = roundMoney(expense.amount_base);
    if (Number.isFinite(balanceByUserId[payerId])) {
      balanceByUserId[payerId] = roundMoney(balanceByUserId[payerId] + amountBase);
    }

    const expenseShares = sharesByExpense[Number(expense.id)] || [];
    expenseShares.forEach((share) => {
      const userId = Number(share.user_id);
      const shareBase = roundMoney(share.share_amount_base);
      if (Number.isFinite(balanceByUserId[userId])) {
        balanceByUserId[userId] = roundMoney(balanceByUserId[userId] - shareBase);
      }
    });
  });

  (settlements || []).forEach((payment) => {
    const fromUserId = Number(payment.from_user_id);
    const toUserId = Number(payment.to_user_id);
    const amountBase = roundMoney(payment.amount_base);
    if (Number.isFinite(balanceByUserId[fromUserId])) {
      balanceByUserId[fromUserId] = roundMoney(balanceByUserId[fromUserId] + amountBase);
    }
    if (Number.isFinite(balanceByUserId[toUserId])) {
      balanceByUserId[toUserId] = roundMoney(balanceByUserId[toUserId] - amountBase);
    }
  });

  return {
    balanceByUserId,
    transfers: buildSimplifiedTransfers(balanceByUserId),
  };
}

async function getGroupMembership(db, userId) {
  const { data, error } = await db
    .from("tricount_group_members")
    .select("group_id, user_id, role, joined_at")
    .eq("user_id", userId);

  if (error) throw error;
  return data || [];
}

export async function getTricountOverview(userId) {
  const db = getDb();
  const memberships = await getGroupMembership(db, userId);
  const groupIds = uniqueNumberIds(memberships.map((member) => member.group_id));

  const [{ data: groups, error: groupsError }, { data: pendingInvites, error: invitesError }] = await Promise.all([
    groupIds.length
      ? db.from("tricount_groups").select("id, name, owner_user_id, base_currency, created_at").in("id", groupIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("tricount_group_invites")
      .select("id, group_id, inviter_user_id, invitee_email, status, created_at")
      .eq("invitee_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (groupsError) throw groupsError;
  if (invitesError) throw invitesError;

  const allGroupIds = uniqueNumberIds([
    ...groupIds,
    ...((pendingInvites || []).map((item) => item.group_id)),
  ]);

  const [
    { data: allMembers, error: membersError },
    { data: allExpenses, error: expensesError },
    { data: allExpenseShares, error: sharesError },
    { data: allSettlements, error: settlementsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    allGroupIds.length
      ? db.from("tricount_group_members").select("group_id, user_id, role, joined_at").in("group_id", allGroupIds)
      : Promise.resolve({ data: [], error: null }),
    allGroupIds.length
      ? db
          .from("tricount_expenses")
          .select("id, group_id, description, amount, currency, amount_base, paid_by_user_id, split_mode, expense_date, created_at")
          .in("group_id", allGroupIds)
          .order("expense_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    allGroupIds.length
      ? db
          .from("tricount_expense_shares")
          .select("expense_id, user_id, share_amount, share_amount_base, share_percentage")
      : Promise.resolve({ data: [], error: null }),
    allGroupIds.length
      ? db
          .from("tricount_settlements")
          .select("id, group_id, from_user_id, to_user_id, amount, currency, amount_base, note, settled_at, created_at")
          .in("group_id", allGroupIds)
          .order("settled_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    db.from("users").select("id, name, email"),
  ]);

  if (membersError) throw membersError;
  if (expensesError) throw expensesError;
  if (sharesError) throw sharesError;
  if (settlementsError) throw settlementsError;
  if (usersError) throw usersError;

  const userMap = (users || []).reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const sharesByExpenseId = (allExpenseShares || []).reduce((acc, share) => {
    const expenseId = Number(share.expense_id);
    if (!acc[expenseId]) acc[expenseId] = [];
    acc[expenseId].push(share);
    return acc;
  }, {});

  const groupsWithStats = (groups || []).map((group) => {
    const members = (allMembers || []).filter((member) => Number(member.group_id) === Number(group.id));
    const expenses = (allExpenses || []).filter((expense) => Number(expense.group_id) === Number(group.id));
    const settlements = (allSettlements || []).filter((settlement) => Number(settlement.group_id) === Number(group.id));
    const shares = expenses.flatMap((expense) => sharesByExpenseId[Number(expense.id)] || []);
    const balance = computeGroupBalance({ members, expenses, shares, settlements });

    return {
      ...group,
      members: members.map((member) => ({
        ...member,
        user: userMap[member.user_id] || null,
      })),
      expenses: expenses.map((expense) => ({
        ...expense,
        payer: userMap[expense.paid_by_user_id] || null,
        shares: sharesByExpenseId[Number(expense.id)] || [],
      })),
      settlements,
      balance,
    };
  });

  const pending = (pendingInvites || []).map((invite) => ({
    ...invite,
    group: (groupsWithStats || []).find((group) => Number(group.id) === Number(invite.group_id)) || null,
    inviter: userMap[invite.inviter_user_id] || null,
  }));

  return {
    groups: groupsWithStats,
    pendingInvites: pending,
  };
}

export async function createTricountInvite({ ownerUserId, inviteeEmail, groupName, baseCurrency = "CHF" }) {
  const db = getDb();
  const email = normalizeEmail(inviteeEmail);
  if (!email) throw new Error("Indica um email válido.");

  const owner = await findUserById(ownerUserId);
  if (!owner) throw new Error("Utilizador autenticado inválido.");

  const invitee = await findUserByEmail(email);
  if (!invitee) {
    throw new Error("Não existe utilizador com esse email nesta app.");
  }
  if (Number(invitee.id) === Number(ownerUserId)) {
    throw new Error("Não podes convidar o teu próprio utilizador.");
  }

  const { data: group, error: groupError } = await db
    .from("tricount_groups")
    .insert({
      name: String(groupName || "Divisão conjunta").trim() || "Divisão conjunta",
      owner_user_id: ownerUserId,
      base_currency: String(baseCurrency || "CHF").toUpperCase(),
      updated_at: new Date().toISOString(),
    })
    .select("id, name, owner_user_id, base_currency, created_at")
    .single();

  if (groupError) throw groupError;

  const { error: ownerMemberError } = await db
    .from("tricount_group_members")
    .insert({
      group_id: group.id,
      user_id: ownerUserId,
      role: "owner",
      joined_at: new Date().toISOString(),
    });

  if (ownerMemberError) throw ownerMemberError;

  const { data: invite, error: inviteError } = await db
    .from("tricount_group_invites")
    .insert({
      group_id: group.id,
      inviter_user_id: ownerUserId,
      invitee_email: email,
      invitee_user_id: invitee.id,
      status: "pending",
    })
    .select("id, group_id, inviter_user_id, invitee_email, invitee_user_id, status, created_at")
    .single();

  if (inviteError) throw inviteError;

  return { group, invite };
}

export async function respondTricountInvite({ userId, inviteId, action }) {
  const db = getDb();
  const normalizedAction = action === "accept" ? "accepted" : "rejected";

  const { data: invite, error: inviteError } = await db
    .from("tricount_group_invites")
    .select("id, group_id, invitee_user_id, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) throw new Error("Convite não encontrado.");
  if (Number(invite.invitee_user_id) !== Number(userId)) {
    throw new Error("Não tens permissão para responder a este convite.");
  }
  if (invite.status !== "pending") {
    throw new Error("Este convite já foi respondido.");
  }

  const { error: updateError } = await db
    .from("tricount_group_invites")
    .update({
      status: normalizedAction,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  if (updateError) throw updateError;

  if (normalizedAction === "accepted") {
    const { error: memberError } = await db
      .from("tricount_group_members")
      .upsert(
        {
          group_id: invite.group_id,
          user_id: userId,
          role: "member",
          joined_at: new Date().toISOString(),
        },
        { onConflict: "group_id,user_id" }
      );

    if (memberError) throw memberError;
  }

  return { ok: true };
}

export async function addTricountExpense({
  userId,
  groupId,
  description,
  amount,
  currency,
  paidByUserId,
  splitMode,
  participantIds,
  percentageShares,
  manualShares,
  expenseDate,
}) {
  const db = getDb();
  const normalizedGroupId = Number(groupId);
  const normalizedPaidByUserId = Number(paidByUserId);

  const { data: group, error: groupError } = await db
    .from("tricount_groups")
    .select("id, base_currency")
    .eq("id", normalizedGroupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error("Grupo não encontrado.");

  const { data: members, error: membersError } = await db
    .from("tricount_group_members")
    .select("group_id, user_id")
    .eq("group_id", normalizedGroupId);
  if (membersError) throw membersError;

  const memberIds = uniqueNumberIds((members || []).map((item) => item.user_id));
  if (!memberIds.includes(Number(userId))) throw new Error("Não tens acesso a este grupo.");
  if (!memberIds.includes(normalizedPaidByUserId)) throw new Error("O pagador selecionado não pertence ao grupo.");

  const normalizedSplitMode = ensureValidSplitMode(splitMode);
  const selectedParticipants = uniqueNumberIds(participantIds).filter((participantId) => memberIds.includes(participantId));
  const shares = calculateSplitShares({
    amount,
    splitMode: normalizedSplitMode,
    participantIds: selectedParticipants,
    percentageShares,
    manualShares,
  });

  const rawAmount = roundMoney(amount);
  if (rawAmount <= 0) throw new Error("O valor da despesa deve ser superior a zero.");

  const fromCurrency = String(currency || group.base_currency || "CHF").toUpperCase();
  const groupCurrency = String(group.base_currency || "CHF").toUpperCase();
  const fxRate = convertCurrency(1, fromCurrency, groupCurrency);
  const amountBase = roundMoney(rawAmount * fxRate);

  const { data: expense, error: expenseError } = await db
    .from("tricount_expenses")
    .insert({
      group_id: normalizedGroupId,
      description: String(description || "Despesa").trim() || "Despesa",
      amount: rawAmount,
      currency: fromCurrency,
      fx_rate_to_base: fxRate,
      amount_base: amountBase,
      paid_by_user_id: normalizedPaidByUserId,
      split_mode: normalizedSplitMode,
      expense_date: expenseDate || new Date().toISOString().slice(0, 10),
      created_by_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (expenseError) throw expenseError;

  const sharesRows = shares.map((share) => {
    const shareAmountBase = roundMoney(share.shareAmount * fxRate);
    return {
      expense_id: expense.id,
      user_id: share.userId,
      share_amount: share.shareAmount,
      share_amount_base: shareAmountBase,
      share_percentage: share.sharePercentage,
    };
  });

  const { error: sharesError } = await db.from("tricount_expense_shares").insert(sharesRows);
  if (sharesError) throw sharesError;

  return { expenseId: expense.id };
}

export async function addTricountSettlement({ userId, groupId, fromUserId, toUserId, amount, currency, note, settledAt }) {
  const db = getDb();
  const normalizedGroupId = Number(groupId);
  const normalizedFromUserId = Number(fromUserId);
  const normalizedToUserId = Number(toUserId);

  if (normalizedFromUserId === normalizedToUserId) {
    throw new Error("Origem e destino da liquidação devem ser diferentes.");
  }

  const { data: group, error: groupError } = await db
    .from("tricount_groups")
    .select("id, base_currency")
    .eq("id", normalizedGroupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error("Grupo não encontrado.");

  const { data: members, error: membersError } = await db
    .from("tricount_group_members")
    .select("user_id")
    .eq("group_id", normalizedGroupId);
  if (membersError) throw membersError;

  const memberIds = uniqueNumberIds((members || []).map((item) => item.user_id));
  if (!memberIds.includes(Number(userId))) throw new Error("Não tens acesso a este grupo.");
  if (!memberIds.includes(normalizedFromUserId) || !memberIds.includes(normalizedToUserId)) {
    throw new Error("Os utilizadores desta liquidação têm de pertencer ao grupo.");
  }

  const rawAmount = roundMoney(amount);
  if (rawAmount <= 0) throw new Error("O valor da liquidação deve ser superior a zero.");

  const fromCurrency = String(currency || group.base_currency || "CHF").toUpperCase();
  const groupCurrency = String(group.base_currency || "CHF").toUpperCase();
  const fxRate = convertCurrency(1, fromCurrency, groupCurrency);
  const amountBase = roundMoney(rawAmount * fxRate);

  const { error } = await db.from("tricount_settlements").insert({
    group_id: normalizedGroupId,
    from_user_id: normalizedFromUserId,
    to_user_id: normalizedToUserId,
    amount: rawAmount,
    currency: fromCurrency,
    fx_rate_to_base: fxRate,
    amount_base: amountBase,
    note: String(note || "").trim() || null,
    settled_at: settledAt || new Date().toISOString().slice(0, 10),
    created_by_user_id: userId,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
  return { ok: true };
}

export async function deleteTricountExpense({ userId, expenseId }) {
  const db = getDb();
  const normalizedExpenseId = Number(expenseId);
  if (!Number.isFinite(normalizedExpenseId) || normalizedExpenseId <= 0) {
    throw new Error("Despesa inválida.");
  }

  const { data: expense, error: expenseFetchError } = await db
    .from("tricount_expenses")
    .select("id, group_id")
    .eq("id", normalizedExpenseId)
    .maybeSingle();

  if (expenseFetchError) throw expenseFetchError;
  if (!expense) throw new Error("Despesa não encontrada.");

  const { data: membership, error: membershipError } = await db
    .from("tricount_group_members")
    .select("group_id, user_id")
    .eq("group_id", Number(expense.group_id))
    .eq("user_id", Number(userId))
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error("Não tens permissão para apagar despesas deste grupo.");
  }

  const { error: sharesDeleteError } = await db
    .from("tricount_expense_shares")
    .delete()
    .eq("expense_id", normalizedExpenseId);

  if (sharesDeleteError) throw sharesDeleteError;

  const { error: expenseDeleteError } = await db
    .from("tricount_expenses")
    .delete()
    .eq("id", normalizedExpenseId);

  if (expenseDeleteError) throw expenseDeleteError;

  return { ok: true };
}
