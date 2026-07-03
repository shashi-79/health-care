type HistoryType = "in" | "out" | "missed";

export type CareHistoryItem = {
  id: number;
  name: string;
  time: string;
  type: HistoryType;
  avatar: string;
};

type CareSessionState = {
  nextHistoryId: number;
  history: CareHistoryItem[];
};

const careStore = new Map<string, CareSessionState>();

const DEFAULT_HISTORY: CareHistoryItem[] = [];

function cloneHistoryItem(item: CareHistoryItem): CareHistoryItem {
  return { ...item };
}

function buildDefaultState(): CareSessionState {
  return {
    nextHistoryId: DEFAULT_HISTORY.length + 1,
    history: DEFAULT_HISTORY.map(cloneHistoryItem)
  };
}

export function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function getOrCreateState(sessionId: string): CareSessionState {
  const key = normalizeSessionId(sessionId);
  const existing = careStore.get(key);
  if (existing) {
    return existing;
  }

  const created = buildDefaultState();
  careStore.set(key, created);
  return created;
}

export function listHistory(sessionId: string): CareHistoryItem[] {
  return getOrCreateState(sessionId).history.map(cloneHistoryItem);
}

export function addHistoryItem(
  sessionId: string,
  item: Omit<CareHistoryItem, "id"> & { id?: number }
): CareHistoryItem {
  const state = getOrCreateState(sessionId);
  const id = typeof item.id === "number" ? item.id : state.nextHistoryId++;

  if (id >= state.nextHistoryId) {
    state.nextHistoryId = id + 1;
  }

  const entry: CareHistoryItem = {
    id,
    name: item.name,
    time: item.time,
    type: item.type,
    avatar: item.avatar
  };

  state.history = [entry, ...state.history];
  return cloneHistoryItem(entry);
}

export function deleteHistoryItems(sessionId: string, ids: number[]): CareHistoryItem[] {
  const state = getOrCreateState(sessionId);
  const idSet = new Set(ids);
  state.history = state.history.filter((item) => !idSet.has(item.id));
  return state.history.map(cloneHistoryItem);
}

export function clearHistory(sessionId: string): CareHistoryItem[] {
  const state = getOrCreateState(sessionId);
  state.history = [];
  return state.history;
}
