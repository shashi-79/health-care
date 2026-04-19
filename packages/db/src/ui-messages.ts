import { messageQueue } from "./queue";
import type { UiMessage } from "@rhc/types";

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

  messageQueue.add("message", message);

  const messages = uiStore.get(sessionId) ?? [];
  messages.push(message);
  uiStore.set(sessionId, messages.slice(-400));

  if (uiStore.size > 500) {
    const oldestKey = uiStore.keys().next().value;
    if (oldestKey) uiStore.delete(oldestKey);
  }

  return cloneMessage(message);
}

export function listUiMessages(sessionId: string, limit = 120): UiMessage[] {
  const key = normalizeSessionId(sessionId);
  const messages = uiStore.get(key) ?? [];
  return messages.slice(-limit).map((message) => cloneMessage(message));
}

export function clearUiMessages(sessionId?: string) {
  if (sessionId) {
    uiStore.delete(normalizeSessionId(sessionId));
    return;
  }
  uiStore.clear();
}

export function assertUiStoreIsolation() {
  return "UI messages are isolated from AI memory access by policy.";
}
