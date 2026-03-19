import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "app.db");

function initDb(db) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS user_data (
      user_id INTEGER PRIMARY KEY,
      portfolios TEXT NOT NULL DEFAULT '[]',
      ideas TEXT NOT NULL DEFAULT '[]',
      goals TEXT NOT NULL DEFAULT '[]',
      calendar_slots TEXT NOT NULL DEFAULT '[]',
      nw_snapshots TEXT NOT NULL DEFAULT '[]',
      start_date TEXT,
      base_currency TEXT NOT NULL DEFAULT 'CHF',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function createDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  initDb(db);
  return db;
}

const globalDb = globalThis;

export function getDb() {
  if (!globalDb.__rotaDb) {
    globalDb.__rotaDb = createDb();
  }
  return globalDb.__rotaDb;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function countUsers() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  return row?.count || 0;
}

export function findUserByEmail(email) {
  const db = getDb();
  return db
    .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?")
    .get(normalizeEmail(email));
}

export function findUserById(id) {
  const db = getDb();
  return db
    .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?")
    .get(id);
}

export function createUser({ name, email, passwordHash }) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(String(name || "").trim(), normalizedEmail, passwordHash);

  return findUserById(result.lastInsertRowid);
}

function parseJsonField(value, fallback) {
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

export function getUserData(userId) {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_data (user_id)
     VALUES (?)
     ON CONFLICT(user_id) DO NOTHING`
  ).run(userId);

  const row = db.prepare("SELECT * FROM user_data WHERE user_id = ?").get(userId);
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

export function saveUserData(userId, data) {
  const db = getDb();
  const payload = {
    ...getDefaultUserData(),
    ...(data || {}),
  };

  db.prepare(
    `INSERT INTO user_data (
      user_id, portfolios, ideas, goals, calendar_slots, nw_snapshots, start_date, base_currency, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      portfolios = excluded.portfolios,
      ideas = excluded.ideas,
      goals = excluded.goals,
      calendar_slots = excluded.calendar_slots,
      nw_snapshots = excluded.nw_snapshots,
      start_date = excluded.start_date,
      base_currency = excluded.base_currency,
      updated_at = CURRENT_TIMESTAMP`
  ).run(
    userId,
    JSON.stringify(payload.portfolios || []),
    JSON.stringify(payload.ideas || []),
    JSON.stringify(payload.goals || []),
    JSON.stringify(payload.calendarSlots || []),
    JSON.stringify(payload.nwHistory || []),
    payload.startDate || null,
    payload.baseCurrency || "CHF"
  );

  return getUserData(userId);
}
