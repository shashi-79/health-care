import type { CareChatBrowserState } from "./types";
import { buildSeededBrowserState } from "./data/seedData";

const CARECHAT_STATE_STORAGE_KEY = "carechat.state.v2";

function assertBrowserEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("Care chat local state can only run in browser.");
  }
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
    !Array.isArray(state.historyItems)
  ) {
    return null;
  }

  return deepCloneState(state as CareChatBrowserState);
}

function readStateFromLocalStorage(): CareChatBrowserState | null {
  const raw = window.localStorage.getItem(CARECHAT_STATE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStateToLocalStorage(state: CareChatBrowserState) {
  window.localStorage.setItem(CARECHAT_STATE_STORAGE_KEY, JSON.stringify(state));
}

export async function loadCareChatBrowserState() {
  assertBrowserEnvironment();
  const state = readStateFromLocalStorage();

  if (state) {
    return deepCloneState(state);
  }

  const seeded = buildSeededBrowserState();
  writeStateToLocalStorage(seeded);

  return deepCloneState(seeded);
}

export async function saveCareChatBrowserState(state: CareChatBrowserState) {
  assertBrowserEnvironment();
  const normalized = normalizeState(state);

  if (!normalized) {
    throw new Error("Invalid care chat state payload.");
  }

  writeStateToLocalStorage(normalized);
}
