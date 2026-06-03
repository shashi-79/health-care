type HistoryType = "in" | "out" | "missed";

export type CareHistoryItem = {
  id: number;
  name: string;
  time: string;
  type: HistoryType;
  avatar: string;
};

export type CareScheduleTone = "primary" | "success" | "warning";

export type CareScheduleItem = {
  id: number;
  scheduleType: string;
  title: string;
  time: string;
  duration: string;
  notes: string;
  dateNumber: string;
  dayLabel: string;
  tone: CareScheduleTone;
  status: "pending" | "done";
  scheduleDate?: string;
};

type CareSessionState = {
  nextHistoryId: number;
  nextScheduleId: number;
  history: CareHistoryItem[];
  schedules: CareScheduleItem[];
};

const careStore = new Map<string, CareSessionState>();

const DEFAULT_HISTORY: CareHistoryItem[] = [];

const DEFAULT_SCHEDULES: CareScheduleItem[] = [];

function cloneHistoryItem(item: CareHistoryItem): CareHistoryItem {
  return { ...item };
}

function cloneScheduleItem(item: CareScheduleItem): CareScheduleItem {
  return { ...item };
}

function buildDefaultState(): CareSessionState {
  return {
    nextHistoryId: DEFAULT_HISTORY.length + 1,
    nextScheduleId: DEFAULT_SCHEDULES.length + 1,
    history: DEFAULT_HISTORY.map(cloneHistoryItem),
    schedules: DEFAULT_SCHEDULES.map(cloneScheduleItem)
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

export function listSchedules(sessionId: string): CareScheduleItem[] {
  return getOrCreateState(sessionId).schedules.map(cloneScheduleItem);
}

export function addScheduleItem(
  sessionId: string,
  schedule: Omit<CareScheduleItem, "id" | "status"> & { status?: "pending" | "done" }
): CareScheduleItem {
  const state = getOrCreateState(sessionId);
  const entry: CareScheduleItem = {
    id: state.nextScheduleId++,
    scheduleType: schedule.scheduleType,
    title: schedule.title,
    time: schedule.time,
    duration: schedule.duration,
    notes: schedule.notes,
    dateNumber: schedule.dateNumber,
    dayLabel: schedule.dayLabel,
    tone: schedule.tone,
    status: schedule.status ?? "pending",
    scheduleDate: schedule.scheduleDate
  };

  state.schedules = [entry, ...state.schedules];
  return cloneScheduleItem(entry);
}

export function updateScheduleStatus(
  sessionId: string,
  id: number,
  status: "pending" | "done"
): CareScheduleItem | null {
  const state = getOrCreateState(sessionId);
  const item = state.schedules.find((entry) => entry.id === id);
  if (!item) {
    return null;
  }

  item.status = status;
  return cloneScheduleItem(item);
}
