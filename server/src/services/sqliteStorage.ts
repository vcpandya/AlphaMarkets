import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Auto-resolve the DB path:
 *  1. SQLITE_DB_PATH env var (explicit)
 *  2. Default: <project-root>/data/alphamarkets.db
 */
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "..", "data", "alphamarkets.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000");
  db.pragma("temp_store = MEMORY");

  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_runs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON saved_runs(timestamp);

    CREATE TABLE IF NOT EXISTS news_history (
      topic_hash TEXT PRIMARY KEY,
      urls TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_history_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_hash TEXT NOT NULL,
      urls TEXT NOT NULL,
      archived_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_archive_topic ON news_history_archive(topic_hash);

    CREATE TABLE IF NOT EXISTS stock_analyses (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(enabled, next_run);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      invited_by TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed: create default admin if no users exist
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (userCount.c === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("usr_admin", "admin", hash, "Administrator", "admin", new Date().toISOString());
    console.log("[DB] Seeded default admin user (username: admin). Change password immediately after first login.");
  }

  // Seed: default server settings
  const settingsCount = db.prepare("SELECT COUNT(*) as c FROM server_settings").get() as { c: number };
  if (settingsCount.c === 0) {
    const defaults: [string, string][] = [
      ["byok", "true"],              // BYOK is default — users enter own keys
      ["registration_open", "false"], // Only admin can invite
    ];
    const insert = db.prepare("INSERT OR IGNORE INTO server_settings (key, value) VALUES (?, ?)");
    for (const [k, v] of defaults) {
      insert.run(k, v);
    }
    console.log("[DB] Seeded default server settings");
  }

  console.log(`[DB] SQLite database ready at ${DB_PATH}`);
  return db;
}

export function isAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

export function getDbPath(): string {
  return DB_PATH;
}

// ─── Saved Runs ─────────────────────────────────────────

export function getAllRuns(): unknown[] {
  const d = getDb();
  const rows = d.prepare("SELECT data FROM saved_runs ORDER BY timestamp DESC").all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function getRun(id: string): unknown | undefined {
  const d = getDb();
  const row = d.prepare("SELECT data FROM saved_runs WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}

export function putRun(run: { id: string; timestamp: string; [key: string]: unknown }): void {
  const d = getDb();
  d.prepare(
    "INSERT OR REPLACE INTO saved_runs (id, timestamp, data) VALUES (?, ?, ?)",
  ).run(run.id, run.timestamp, JSON.stringify(run));
}

export function deleteRun(id: string): void {
  const d = getDb();
  d.prepare("DELETE FROM saved_runs WHERE id = ?").run(id);
}

export function countRuns(): number {
  const d = getDb();
  const row = d.prepare("SELECT COUNT(*) as count FROM saved_runs").get() as { count: number };
  return row.count;
}

// ─── News History ───────────────────────────────────────

export function getNewsHistory(topicHash: string): string[] {
  const d = getDb();
  const row = d.prepare("SELECT urls FROM news_history WHERE topic_hash = ?").get(topicHash) as { urls: string } | undefined;
  return row ? JSON.parse(row.urls) : [];
}

const MAX_ACTIVE_URLS = 1000;

export function addNewsHistory(topicHash: string, newUrls: string[]): void {
  const d = getDb();
  const existing = getNewsHistory(topicHash);
  const merged = Array.from(new Set([...existing, ...newUrls]));

  if (merged.length > MAX_ACTIVE_URLS) {
    // Archive the oldest URLs before trimming
    const overflow = merged.slice(0, merged.length - MAX_ACTIVE_URLS);
    d.prepare(
      "INSERT INTO news_history_archive (topic_hash, urls, archived_at) VALUES (?, ?, ?)",
    ).run(topicHash, JSON.stringify(overflow), new Date().toISOString());

    const kept = merged.slice(-MAX_ACTIVE_URLS);
    d.prepare(
      "INSERT OR REPLACE INTO news_history (topic_hash, urls) VALUES (?, ?)",
    ).run(topicHash, JSON.stringify(kept));
  } else {
    d.prepare(
      "INSERT OR REPLACE INTO news_history (topic_hash, urls) VALUES (?, ?)",
    ).run(topicHash, JSON.stringify(merged));
  }
}

export function getArchivedNewsHistory(topicHash: string): string[] {
  const d = getDb();
  const rows = d.prepare(
    "SELECT urls FROM news_history_archive WHERE topic_hash = ? ORDER BY archived_at ASC",
  ).all(topicHash) as { urls: string }[];
  const all: string[] = [];
  for (const row of rows) {
    all.push(...JSON.parse(row.urls));
  }
  return all;
}

// ─── Stock Analyses ─────────────────────────────────────

export function getStockAnalysis(key: string): { data: unknown; timestamp: string } | undefined {
  const d = getDb();
  const row = d.prepare("SELECT data, timestamp FROM stock_analyses WHERE key = ?").get(key) as { data: string; timestamp: string } | undefined;
  if (!row) return undefined;
  return { data: JSON.parse(row.data), timestamp: row.timestamp };
}

export function putStockAnalysis(key: string, data: unknown): void {
  const d = getDb();
  d.prepare(
    "INSERT OR REPLACE INTO stock_analyses (key, data, timestamp) VALUES (?, ?, ?)",
  ).run(key, JSON.stringify(data), new Date().toISOString());
}

// ─── Schedules ──────────────────────────────────────────

export function getAllSchedules(): unknown[] {
  const d = getDb();
  const rows = d.prepare("SELECT data FROM schedules ORDER BY next_run ASC").all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function getSchedule(id: string): unknown | undefined {
  const d = getDb();
  const row = d.prepare("SELECT data FROM schedules WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}

export function putSchedule(schedule: { id: string; enabled: boolean; nextRun?: string }): void {
  const d = getDb();
  d.prepare(
    "INSERT OR REPLACE INTO schedules (id, data, enabled, next_run) VALUES (?, ?, ?, ?)",
  ).run(schedule.id, JSON.stringify(schedule), schedule.enabled ? 1 : 0, schedule.nextRun || null);
}

export function deleteSchedule(id: string): void {
  const d = getDb();
  d.prepare("DELETE FROM schedules WHERE id = ?").run(id);
}

export function getDueSchedules(now: string): unknown[] {
  const d = getDb();
  const rows = d.prepare(
    "SELECT data FROM schedules WHERE enabled = 1 AND next_run IS NOT NULL AND next_run <= ?",
  ).all(now) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

// ─── Users ──────────────────────────────────────────────

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  role: "admin" | "user";
  invited_by: string | null;
  created_at: string;
  last_login: string | null;
}

export function getUserByUsername(username: string): UserRow | undefined {
  const d = getDb();
  return d.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  const d = getDb();
  return d.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getAllUsers(): UserRow[] {
  const d = getDb();
  return d.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
}

export function createUser(user: {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  role: "admin" | "user";
  invitedBy?: string;
}): void {
  const d = getDb();
  d.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(user.id, user.username, user.passwordHash, user.displayName || user.username, user.role, user.invitedBy || null, new Date().toISOString());
}

export function updateUserPassword(id: string, passwordHash: string): void {
  const d = getDb();
  d.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function updateUserLastLogin(id: string): void {
  const d = getDb();
  d.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function deleteUser(id: string): void {
  const d = getDb();
  // Prevent deleting the last admin
  const admins = d.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number };
  const user = getUserById(id);
  if (user?.role === "admin" && admins.c <= 1) {
    throw new Error("Cannot delete the last admin user");
  }
  d.prepare("DELETE FROM users WHERE id = ?").run(id);
}

// ─── Server Settings ────────────────────────────────────

export function getServerSetting(key: string): string | undefined {
  const d = getDb();
  const row = d.prepare("SELECT value FROM server_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setServerSetting(key: string, value: string): void {
  const d = getDb();
  d.prepare("INSERT OR REPLACE INTO server_settings (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllServerSettings(): Record<string, string> {
  const d = getDb();
  const rows = d.prepare("SELECT key, value FROM server_settings").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}
