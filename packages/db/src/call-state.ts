import { getDatabase } from "./pool";

export type CallStatus = "idle" | "ringing" | "active" | "ended" | "missed";
export type CallDirection = "incoming" | "outgoing" | null;

export type CareCallState = {
  sessionId: string;
  status: CallStatus;
  direction: CallDirection;
  contactName: string;
  updatedAt: string;
  startedAtMs: number | null;
  endedAtMs: number | null;
  ringToken: number;
};

const callStore = new Map<string, CareCallState>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeSessionId(sessionId: string) {
  const value = sessionId.trim();
  return value.length > 0 ? value : "default";
}

function cloneCallState(state: CareCallState): CareCallState {
  return { ...state };
}

function buildDefaultState(sessionId: string): CareCallState {
  return {
    sessionId,
    status: "idle",
    direction: null,
    contactName: "Mohan",
    updatedAt: nowIso(),
    startedAtMs: null,
    endedAtMs: null,
    ringToken: 0
  };
}

export async function dbGetCallState(sessionId: string): Promise<CareCallState> {
  const key = normalizeSessionId(sessionId);
  try {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT status, direction, contact_name AS "contactName", updated_at AS "updatedAt", started_at_ms AS "startedAtMs", ended_at_ms AS "endedAtMs", ring_token AS "ringToken"
       FROM call_state
       WHERE session_id = ?`
    );
    const row = stmt.get(key) as any;
    if (row) {
      return {
        sessionId: key,
        status: row.status,
        direction: row.direction || null,
        contactName: row.contactName,
        updatedAt: new Date(row.updatedAt).toISOString(),
        startedAtMs: row.startedAtMs ? Number(row.startedAtMs) : null,
        endedAtMs: row.endedAtMs ? Number(row.endedAtMs) : null,
        ringToken: Number(row.ringToken)
      };
    }
  } catch (error) {
    console.warn("[db] Failed to fetch call state from SQLite:", error);
  }

  // Fallback to memory
  let existing = callStore.get(key);
  if (!existing) {
    existing = buildDefaultState(key);
    callStore.set(key, existing);
  }
  return cloneCallState(existing);
}

export async function dbSaveCallState(state: CareCallState): Promise<void> {
  const key = normalizeSessionId(state.sessionId);
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO call_state (session_id, status, direction, contact_name, updated_at, started_at_ms, ended_at_ms, ring_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        status = excluded.status,
        direction = excluded.direction,
        contact_name = excluded.contact_name,
        updated_at = excluded.updated_at,
        started_at_ms = excluded.started_at_ms,
        ended_at_ms = excluded.ended_at_ms,
        ring_token = excluded.ring_token
    `);
    stmt.run(
      key,
      state.status,
      state.direction,
      state.contactName,
      new Date(state.updatedAt).toISOString(),
      state.startedAtMs,
      state.endedAtMs,
      state.ringToken
    );
  } catch (error) {
    console.warn("[db] Failed to save call state to SQLite:", error);
  }

  // Always write to memory
  callStore.set(key, cloneCallState(state));
}
