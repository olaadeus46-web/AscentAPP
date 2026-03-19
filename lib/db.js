import { createClient } from "@supabase/supabase-js";

const globalDb = globalThis;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
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
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_SERVICE_ROLE_KEY)."
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

export function getDefaultUserData() {
  return {
    portfolios: [],
    ideas: [],
    goals: [],
    calendarSlots: [],
    nwHistory: [],
    startDate: null,
    baseCurrency: "CHF",
  };
}

export async function getUserData(userId) {
  const db = getDb();
  const defaults = getDefaultUserData();

  const { error: upsertError } = await db.from("user_data").upsert(
    {
      user_id: userId,
      portfolios: defaults.portfolios,
      ideas: defaults.ideas,
      goals: defaults.goals,
      calendar_slots: defaults.calendarSlots,
      nw_snapshots: defaults.nwHistory,
      start_date: defaults.startDate,
      base_currency: defaults.baseCurrency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

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

  const { error } = await db.from("user_data").upsert(
    {
      user_id: userId,
      portfolios: payload.portfolios || [],
      ideas: payload.ideas || [],
      goals: payload.goals || [],
      calendar_slots: payload.calendarSlots || [],
      nw_snapshots: payload.nwHistory || [],
      start_date: payload.startDate || null,
      base_currency: payload.baseCurrency || "CHF",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  return getUserData(userId);
}
