import { dbGetCallState, dbSaveCallState, CareCallState, CallStatus, CallDirection } from "@rhc/db";

export type { CareCallState, CallStatus, CallDirection };

export function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

export async function getCallState(sessionId: string): Promise<CareCallState> {
  return dbGetCallState(sessionId);
}

export async function startOutgoingCall(sessionId: string, contactName = "Mohan"): Promise<CareCallState> {
  const state = await dbGetCallState(sessionId);
  state.status = "ringing";
  state.direction = "outgoing";
  state.contactName = contactName;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.updatedAt = new Date().toISOString();
  state.ringToken += 1;
  await dbSaveCallState(state);
  return state;
}

export async function acceptCall(sessionId: string): Promise<CareCallState> {
  const state = await dbGetCallState(sessionId);
  state.status = "active";
  state.startedAtMs = state.startedAtMs ?? Date.now();
  state.endedAtMs = null;
  state.updatedAt = new Date().toISOString();
  await dbSaveCallState(state);
  return state;
}

export async function endCall(sessionId: string): Promise<CareCallState> {
  const state = await dbGetCallState(sessionId);
  state.status = state.status === "ringing" && state.direction === "incoming" ? "missed" : "ended";
  state.endedAtMs = Date.now();
  state.updatedAt = new Date().toISOString();
  await dbSaveCallState(state);
  return state;
}

export async function clearCallState(sessionId: string): Promise<CareCallState> {
  const state = await dbGetCallState(sessionId);
  state.status = "idle";
  state.direction = null;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.updatedAt = new Date().toISOString();
  await dbSaveCallState(state);
  return state;
}
