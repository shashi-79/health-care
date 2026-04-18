import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { CareChatBrowserState } from "./types";
import { buildSeededBrowserState } from "./data/seedData";

const SQLITE_DB_STORAGE_KEY = "carechat.sqlite.db.v1";
const SQLITE_STATE_KEY = "carechat-state";

let sqlStaticPromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;

function assertBrowserEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("localSqliteStore can only run in browser.");
  }
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

function decodeBase64ToBytes(encoded: string) {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function deepCloneState(state: CareChatBrowserState): CareChatBrowserState {
  return JSON.parse(JSON.stringify(state)) as CareChatBrowserState;
}

function normalizeState(input: unknown): CareChatBrowserState | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const state = input as Partial<CareChatBrowserState>;
  if (
    !state.profile ||
    !Array.isArray(state.chatMessages) ||
    !Array.isArray(state.historyItems) ||
    !Array.isArray(state.scheduleItems) ||
    !Array.isArray(state.mediaImages) ||
    !Array.isArray(state.mediaDocs) ||
    !Array.isArray(state.mediaLinks)
  ) {
    return null;
  }

  return deepCloneState(state as CareChatBrowserState);
}

function ensureSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS care_chat_state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL
    );
  `);
}

function readStateFromDb(db: Database): CareChatBrowserState | null {
  const statement = db.prepare("SELECT state_value FROM care_chat_state WHERE state_key = ?");

  try {
    statement.bind([SQLITE_STATE_KEY]);
    if (!statement.step()) {
      return null;
    }

    const row = statement.getAsObject() as { state_value?: unknown };
    if (typeof row.state_value !== "string") {
      return null;
    }

    const parsed = JSON.parse(row.state_value) as unknown;
    return normalizeState(parsed);
  } catch {
    return null;
  } finally {
    statement.free();
  }
}

function writeStateToDb(db: Database, state: CareChatBrowserState) {
  const serialized = JSON.stringify(state);

  db.run("DELETE FROM care_chat_state WHERE state_key = ?", [SQLITE_STATE_KEY]);
  db.run("INSERT INTO care_chat_state (state_key, state_value) VALUES (?, ?)", [SQLITE_STATE_KEY, serialized]);
}

function persistDatabaseSnapshot(db: Database) {
  const bytes = db.export();
  const encoded = encodeBytesToBase64(bytes);
  window.localStorage.setItem(SQLITE_DB_STORAGE_KEY, encoded);
}

function getSqlStatic() {
  assertBrowserEnvironment();

  if (!sqlStaticPromise) {
    sqlStaticPromise = initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  return sqlStaticPromise;
}

async function createOrRestoreDatabase() {
  assertBrowserEnvironment();
  const SQL = await getSqlStatic();

  const encoded = window.localStorage.getItem(SQLITE_DB_STORAGE_KEY);

  let db: Database;
  if (!encoded) {
    db = new SQL.Database();
  } else {
    try {
      db = new SQL.Database(decodeBase64ToBytes(encoded));
    } catch {
      db = new SQL.Database();
    }
  }

  ensureSchema(db);

  const existing = readStateFromDb(db);
  if (!existing) {
    writeStateToDb(db, buildSeededBrowserState());
    persistDatabaseSnapshot(db);
  }

  return db;
}

async function getDatabase() {
  assertBrowserEnvironment();

  if (!dbPromise) {
    dbPromise = createOrRestoreDatabase();
  }

  return dbPromise;
}

export async function loadCareChatBrowserState() {
  const db = await getDatabase();
  const state = readStateFromDb(db);

  if (state) {
    return deepCloneState(state);
  }

  const seeded = buildSeededBrowserState();
  writeStateToDb(db, seeded);
  persistDatabaseSnapshot(db);

  return deepCloneState(seeded);
}

export async function saveCareChatBrowserState(state: CareChatBrowserState) {
  const db = await getDatabase();
  writeStateToDb(db, deepCloneState(state));
  persistDatabaseSnapshot(db);
}
