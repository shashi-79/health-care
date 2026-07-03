import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: Database.Database | null = null;
function getDatabasePath(): string {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return ":memory:";
  }
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }
  // Try to find the workspace root folder containing packages/
  let currentDir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(currentDir, "package.json")) && fs.existsSync(path.join(currentDir, "packages"))) {
      return path.join(currentDir, "db.sqlite");
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return path.resolve(process.cwd(), "db.sqlite");
}

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = getDatabasePath();
  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("synchronous = NORMAL");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("temp_store = MEMORY");
  dbInstance.pragma("cache_size = -2000");
  ensureTablesInitialized(dbInstance);
  return dbInstance;
}

export function getPool() {
  // Return dummy pool for compatibility if needed, or null.
  // We'll update the queries to use getDatabase directly.
  return null;
}

function ensureTablesInitialized(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_memory (
      session_id TEXT PRIMARY KEY,
      root_details TEXT,
      current_illness TEXT,
      past_illnesses TEXT NOT NULL DEFAULT '[]',
      risk_flags TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS call_state (
      session_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      direction TEXT,
      contact_name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at_ms INTEGER,
      ended_at_ms INTEGER,
      ring_token INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      run_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_run_at ON scheduled_jobs (status, run_at);
  `);
}
