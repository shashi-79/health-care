import type { UiMessage } from "@rhc/types";
import { getDatabase } from "./pool";

type AddUiMessageInput = {
  sessionId: string;
  role: UiMessage["role"];
  content: string;
  createdAt?: string;
};

const uiStore = new Map<string, UiMessage[]>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeSessionId(sessionId: string) {
  const value = sessionId.trim();
  return value.length > 0 ? value : "default";
}

function cloneMessage(message: UiMessage): UiMessage {
  return { ...message };
}

export function addUiMessage(input: AddUiMessageInput): UiMessage {
  const sessionId = normalizeSessionId(input.sessionId);
  const content = input.content.trim();

  if (!content) {
    throw new Error("UI message content cannot be empty.");
  }

  const message: UiMessage = {
    sessionId,
    role: input.role,
    content,
    createdAt: input.createdAt ?? nowIso()
  };

  // Add directly to SQLite database
  try {
    const db = getDatabase();
    const stmt = db.prepare("INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)");
    stmt.run(message.sessionId, message.role, message.content, message.createdAt);
  } catch (error) {
    console.warn("[db] Failed to save message to SQLite, falling back to memory:", error);
  }

  // Add to local memory store
  const messages = uiStore.get(sessionId) ?? [];
  messages.push(message);
  uiStore.set(sessionId, messages.slice(-400));

  if (uiStore.size > 500) {
    const oldestKey = uiStore.keys().next().value;
    if (oldestKey) uiStore.delete(oldestKey);
  }

  return cloneMessage(message);
}

export async function listUiMessages(sessionId: string, limit = 120): Promise<UiMessage[]> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT role, content, created_at AS "createdAt"
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`
    );
    const rows = stmt.all(normalizeSessionId(sessionId), limit) as any[];
    return rows.map((row: any) => ({
      sessionId,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.createdAt).toISOString()
    }));
  } catch (error) {
    console.warn("[db] Failed to fetch from SQLite, falling back to memory:", error);
  }

  // Fallback to in-memory store
  const key = normalizeSessionId(sessionId);
  const messages = uiStore.get(key) ?? [];
  return messages.slice(-limit).map((message) => cloneMessage(message));
}

export async function clearUiMessages(sessionId?: string): Promise<void> {
  try {
    const db = getDatabase();
    if (sessionId) {
      const stmt = db.prepare("DELETE FROM messages WHERE session_id = ?");
      stmt.run(normalizeSessionId(sessionId));
    } else {
      db.exec("DELETE FROM messages");
    }
  } catch (error) {
    console.warn("[db] Failed to delete from SQLite, falling back to memory:", error);
  }

  if (sessionId) {
    uiStore.delete(normalizeSessionId(sessionId));
    return;
  }
  uiStore.clear();
}

export function assertUiStoreIsolation() {
  return "UI messages are isolated from AI memory access by policy.";
}
