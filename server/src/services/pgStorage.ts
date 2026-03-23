import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// ─── Schema Init ─────────────────────────────────────────

let initialized = false;

export async function initDb(): Promise<void> {
  if (initialized) return;

  await query(`
    CREATE TABLE IF NOT EXISTS saved_runs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      data JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON saved_runs(timestamp);

    CREATE TABLE IF NOT EXISTS news_history (
      topic_hash TEXT PRIMARY KEY,
      urls JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_history_archive (
      id SERIAL PRIMARY KEY,
      topic_hash TEXT NOT NULL,
      urls JSONB NOT NULL,
      archived_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_archive_topic ON news_history_archive(topic_hash);

    CREATE TABLE IF NOT EXISTS stock_analyses (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
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

    CREATE TABLE IF NOT EXISTS shared_runs (
      token TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      run_data JSONB NOT NULL,
      password_hash TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default admin
  const userCount = await query("SELECT COUNT(*) AS c FROM users");
  if (parseInt(userCount.rows[0].c, 10) === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    await query(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
      ["usr_admin", "admin", hash, "Administrator", "admin", new Date().toISOString()],
    );
    console.log("[DB] Seeded default admin user (username: admin). Change password immediately after first login.");
  }

  // Seed default server settings
  const settingsCount = await query("SELECT COUNT(*) AS c FROM server_settings");
  if (parseInt(settingsCount.rows[0].c, 10) === 0) {
    const defaults: [string, string][] = [
      ["byok", "true"],
      ["registration_open", "false"],
    ];
    for (const [k, v] of defaults) {
      await query("INSERT INTO server_settings (key, value) VALUES ($1,$2) ON CONFLICT DO NOTHING", [k, v]);
    }
    console.log("[DB] Seeded default server settings");
  }

  initialized = true;
  console.log("[DB] PostgreSQL database ready");
}

export function isAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDbPath(): string {
  return process.env.DATABASE_URL ?? "";
}

// ─── Saved Runs ─────────────────────────────────────────

export async function getAllRuns(): Promise<unknown[]> {
  await initDb();
  const result = await query("SELECT data FROM saved_runs ORDER BY timestamp DESC");
  return result.rows.map((r) => r.data);
}

export async function getRun(id: string): Promise<unknown | undefined> {
  await initDb();
  const result = await query("SELECT data FROM saved_runs WHERE id = $1", [id]);
  return result.rows[0]?.data;
}

export async function putRun(run: { id: string; timestamp: string; [key: string]: unknown }): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO saved_runs (id, timestamp, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET timestamp=$2, data=$3",
    [run.id, run.timestamp, JSON.stringify(run)],
  );
}

export async function deleteRun(id: string): Promise<void> {
  await initDb();
  await query("DELETE FROM saved_runs WHERE id = $1", [id]);
}

export async function countRuns(): Promise<number> {
  await initDb();
  const result = await query("SELECT COUNT(*) AS count FROM saved_runs");
  return parseInt(result.rows[0].count, 10);
}

// ─── News History ───────────────────────────────────────

const MAX_ACTIVE_URLS = 1000;

export async function getNewsHistory(topicHash: string): Promise<string[]> {
  await initDb();
  const result = await query("SELECT urls FROM news_history WHERE topic_hash = $1", [topicHash]);
  return result.rows[0]?.urls ?? [];
}

export async function addNewsHistory(topicHash: string, newUrls: string[]): Promise<void> {
  await initDb();
  const existing = await getNewsHistory(topicHash);
  const merged = Array.from(new Set([...existing, ...newUrls]));

  if (merged.length > MAX_ACTIVE_URLS) {
    const overflow = merged.slice(0, merged.length - MAX_ACTIVE_URLS);
    await query(
      "INSERT INTO news_history_archive (topic_hash, urls, archived_at) VALUES ($1,$2,$3)",
      [topicHash, JSON.stringify(overflow), new Date().toISOString()],
    );
    const kept = merged.slice(-MAX_ACTIVE_URLS);
    await query(
      "INSERT INTO news_history (topic_hash, urls) VALUES ($1,$2) ON CONFLICT (topic_hash) DO UPDATE SET urls=$2",
      [topicHash, JSON.stringify(kept)],
    );
  } else {
    await query(
      "INSERT INTO news_history (topic_hash, urls) VALUES ($1,$2) ON CONFLICT (topic_hash) DO UPDATE SET urls=$2",
      [topicHash, JSON.stringify(merged)],
    );
  }
}

export async function getArchivedNewsHistory(topicHash: string): Promise<string[]> {
  await initDb();
  const result = await query(
    "SELECT urls FROM news_history_archive WHERE topic_hash = $1 ORDER BY archived_at ASC",
    [topicHash],
  );
  const all: string[] = [];
  for (const row of result.rows) {
    all.push(...(row.urls as string[]));
  }
  return all;
}

// ─── Stock Analyses ─────────────────────────────────────

export async function getStockAnalysis(key: string): Promise<{ data: unknown; timestamp: string } | undefined> {
  await initDb();
  const result = await query("SELECT data, timestamp FROM stock_analyses WHERE key = $1", [key]);
  if (!result.rows[0]) return undefined;
  return { data: result.rows[0].data, timestamp: result.rows[0].timestamp };
}

export async function putStockAnalysis(key: string, data: unknown): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO stock_analyses (key, data, timestamp) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET data=$2, timestamp=$3",
    [key, JSON.stringify(data), new Date().toISOString()],
  );
}

// ─── Schedules ──────────────────────────────────────────

export async function getAllSchedules(): Promise<unknown[]> {
  await initDb();
  const result = await query("SELECT data FROM schedules ORDER BY next_run ASC NULLS LAST");
  return result.rows.map((r) => r.data);
}

export async function getSchedule(id: string): Promise<unknown | undefined> {
  await initDb();
  const result = await query("SELECT data FROM schedules WHERE id = $1", [id]);
  return result.rows[0]?.data;
}

export async function putSchedule(schedule: { id: string; enabled: boolean; nextRun?: string }): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO schedules (id, data, enabled, next_run) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET data=$2, enabled=$3, next_run=$4",
    [schedule.id, JSON.stringify(schedule), schedule.enabled, schedule.nextRun ?? null],
  );
}

export async function deleteSchedule(id: string): Promise<void> {
  await initDb();
  await query("DELETE FROM schedules WHERE id = $1", [id]);
}

export async function getDueSchedules(now: string): Promise<unknown[]> {
  await initDb();
  const result = await query(
    "SELECT data FROM schedules WHERE enabled = TRUE AND next_run IS NOT NULL AND next_run <= $1",
    [now],
  );
  return result.rows.map((r) => r.data);
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

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
  await initDb();
  const result = await query("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0];
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  await initDb();
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
}

export async function getAllUsers(): Promise<UserRow[]> {
  await initDb();
  const result = await query("SELECT * FROM users ORDER BY created_at ASC");
  return result.rows;
}

export async function createUser(user: {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  role: "admin" | "user";
  invitedBy?: string;
}): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO users (id, username, password_hash, display_name, role, invited_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [user.id, user.username, user.passwordHash, user.displayName || user.username, user.role, user.invitedBy || null, new Date().toISOString()],
  );
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await initDb();
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
}

export async function updateUserLastLogin(id: string): Promise<void> {
  await initDb();
  await query("UPDATE users SET last_login = $1 WHERE id = $2", [new Date().toISOString(), id]);
}

export async function deleteUser(id: string): Promise<void> {
  await initDb();
  const admins = await query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
  const user = await getUserById(id);
  if (user?.role === "admin" && parseInt(admins.rows[0].c, 10) <= 1) {
    throw new Error("Cannot delete the last admin user");
  }
  await query("DELETE FROM users WHERE id = $1", [id]);
}

// ─── Server Settings ────────────────────────────────────

export async function getServerSetting(key: string): Promise<string | undefined> {
  await initDb();
  const result = await query("SELECT value FROM server_settings WHERE key = $1", [key]);
  return result.rows[0]?.value;
}

export async function setServerSetting(key: string, value: string): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO server_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
    [key, value],
  );
}

export async function getAllServerSettings(): Promise<Record<string, string>> {
  await initDb();
  const result = await query("SELECT key, value FROM server_settings");
  const out: Record<string, string> = {};
  for (const row of result.rows) out[row.key] = row.value;
  return out;
}

// ─── Shared Runs ─────────────────────────────────────────

export interface SharedRunRow {
  token: string;
  run_id: string;
  run_data: unknown;
  password_hash: string | null;
  expires_at: string | null;
  created_at: string;
}

export async function createSharedRun(params: {
  token: string;
  runId: string;
  runData: unknown;
  passwordHash?: string;
  expiresAt?: string;
}): Promise<void> {
  await initDb();
  await query(
    "INSERT INTO shared_runs (token, run_id, run_data, password_hash, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [params.token, params.runId, JSON.stringify(params.runData), params.passwordHash ?? null, params.expiresAt ?? null, new Date().toISOString()],
  );
}

export async function getSharedRun(token: string): Promise<SharedRunRow | undefined> {
  await initDb();
  const result = await query("SELECT * FROM shared_runs WHERE token = $1", [token]);
  return result.rows[0];
}

export async function deleteSharedRun(token: string): Promise<void> {
  await initDb();
  await query("DELETE FROM shared_runs WHERE token = $1", [token]);
}

export async function deleteSharedRunsByRunId(runId: string): Promise<void> {
  await initDb();
  await query("DELETE FROM shared_runs WHERE run_id = $1", [runId]);
}
