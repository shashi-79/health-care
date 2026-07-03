import { getDatabase } from "./pool";
import type { SessionMemory } from "@rhc/types";

const memoryStore = new Map<string, SessionMemory>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeSessionId(sessionId: string) {
  const value = sessionId.trim();
  return value.length > 0 ? value : "default";
}

function cloneMemory(memory: SessionMemory): SessionMemory {
  return {
    ...memory,
    rootDetails: memory.rootDetails ? { ...memory.rootDetails } : undefined,
    pastIllnesses: [...memory.pastIllnesses],
    riskFlags: [...memory.riskFlags]
  };
}

function buildDefaultMemory(sessionId: string): SessionMemory {
  return {
    sessionId,
    pastIllnesses: [],
    riskFlags: [],
    updatedAt: nowIso()
  };
}

export async function dbGetSessionMemory(sessionId: string): Promise<SessionMemory> {
  const key = normalizeSessionId(sessionId);
  try {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT root_details AS "rootDetails", current_illness AS "currentIllness", past_illnesses AS "pastIllnesses", risk_flags AS "riskFlags", updated_at AS "updatedAt"
       FROM session_memory
       WHERE session_id = ?`
    );
    const row = stmt.get(key) as any;
    if (row) {
      return {
        sessionId: key,
        rootDetails: row.rootDetails ? JSON.parse(row.rootDetails) : undefined,
        currentIllness: row.currentIllness || undefined,
        pastIllnesses: row.pastIllnesses ? JSON.parse(row.pastIllnesses) : [],
        riskFlags: row.riskFlags ? JSON.parse(row.riskFlags) : [],
        updatedAt: new Date(row.updatedAt).toISOString()
      };
    }
  } catch (error) {
    console.warn("[db] Failed to fetch session memory from SQLite:", error);
  }

  // Fallback to memory
  let existing = memoryStore.get(key);
  if (!existing) {
    existing = buildDefaultMemory(key);
    memoryStore.set(key, existing);
  }
  return cloneMemory(existing);
}

export async function dbSaveSessionMemory(memory: SessionMemory): Promise<void> {
  const key = normalizeSessionId(memory.sessionId);
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO session_memory (session_id, root_details, current_illness, past_illnesses, risk_flags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        root_details = excluded.root_details,
        current_illness = excluded.current_illness,
        past_illnesses = excluded.past_illnesses,
        risk_flags = excluded.risk_flags,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      key,
      memory.rootDetails ? JSON.stringify(memory.rootDetails) : null,
      memory.currentIllness || null,
      JSON.stringify(memory.pastIllnesses || []),
      JSON.stringify(memory.riskFlags || []),
      new Date(memory.updatedAt).toISOString()
    );
  } catch (error) {
    console.warn("[db] Failed to save session memory to SQLite:", error);
  }

  // Always write to memory
  memoryStore.set(key, cloneMemory(memory));
}

export async function dbListSessionMemories(): Promise<SessionMemory[]> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT session_id AS "sessionId", root_details AS "rootDetails", current_illness AS "currentIllness", past_illnesses AS "pastIllnesses", risk_flags AS "riskFlags", updated_at AS "updatedAt"
       FROM session_memory`
    );
    const rows = stmt.all() as any[];
    return rows.map((row: any) => ({
      sessionId: row.sessionId,
      rootDetails: row.rootDetails ? JSON.parse(row.rootDetails) : undefined,
      currentIllness: row.currentIllness || undefined,
      pastIllnesses: row.pastIllnesses ? JSON.parse(row.pastIllnesses) : [],
      riskFlags: row.riskFlags ? JSON.parse(row.riskFlags) : [],
      updatedAt: new Date(row.updatedAt).toISOString()
    }));
  } catch (error) {
    console.warn("[db] Failed to list session memories from SQLite:", error);
  }

  // Fallback to memory
  return [...memoryStore.values()].map((memory) => cloneMemory(memory));
}

export function dbResetSessionMemoryStore() {
  try {
    const db = getDatabase();
    db.exec("DELETE FROM session_memory");
  } catch (error) {
    console.warn("[db] Failed to reset session memory in SQLite:", error);
  }
  memoryStore.clear();
}
