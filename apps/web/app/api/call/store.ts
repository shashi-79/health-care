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

type StoredCallState = CareCallState;

const callStore = new Map<string, StoredCallState>();

function nowIso() {
  return new Date().toISOString();
}

export function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

function cloneCallState(state: StoredCallState): CareCallState {
  return { ...state };
}

function buildDefaultState(sessionId: string): StoredCallState {
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

function getOrCreate(sessionId: string): StoredCallState {
  const key = normalizeSessionId(sessionId);
  const existing = callStore.get(key);
  if (existing) {
    return existing;
  }

  const created = buildDefaultState(key);
  callStore.set(key, created);
  return created;
}

export function getCallState(sessionId: string): CareCallState {
  return cloneCallState(getOrCreate(sessionId));
}

export function startOutgoingCall(sessionId: string, contactName = "Mohan") {
  const state = getOrCreate(sessionId);
  state.status = "ringing";
  state.direction = "outgoing";
  state.contactName = contactName;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.updatedAt = nowIso();
  state.ringToken += 1;
  return cloneCallState(state);
}

export function acceptCall(sessionId: string) {
  const state = getOrCreate(sessionId);
  state.status = "active";
  state.startedAtMs = state.startedAtMs ?? Date.now();
  state.endedAtMs = null;
  state.updatedAt = nowIso();
  return cloneCallState(state);
}

export function endCall(sessionId: string) {
  const state = getOrCreate(sessionId);
  state.status = state.status === "ringing" && state.direction === "incoming" ? "missed" : "ended";
  state.endedAtMs = Date.now();
  state.updatedAt = nowIso();
  return cloneCallState(state);
}

export function clearCallState(sessionId: string) {
  const state = getOrCreate(sessionId);
  state.status = "idle";
  state.direction = null;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.updatedAt = nowIso();
  return cloneCallState(state);
}
