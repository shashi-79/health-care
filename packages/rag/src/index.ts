import type { SessionMemory, SessionMemoryPatch } from "@rhc/types";
import { dbGetSessionMemory, dbSaveSessionMemory, dbListSessionMemories, dbResetSessionMemoryStore } from "@rhc/db";

function nowIso() {
	return new Date().toISOString();
}

function normalizeSessionId(sessionId: string) {
	const value = sessionId.trim();
	return value.length > 0 ? value : "default";
}

function normalizeStringList(input: string[] | undefined, maxItems: number) {
	if (!input) return [];

	const normalized = input
		.map((value) => value.trim())
		.filter((value) => value.length > 0)
		.slice(0, maxItems);

	return [...new Set(normalized)];
}

export async function getSessionMemory(sessionId: string): Promise<SessionMemory> {
	return dbGetSessionMemory(sessionId);
}

export async function patchSessionMemory(sessionId: string, patch: SessionMemoryPatch): Promise<SessionMemory> {
	const current = await dbGetSessionMemory(sessionId);

	const next: SessionMemory = {
		...current,
		rootDetails: patch.rootDetails ?? current.rootDetails,
		currentIllness: patch.currentIllness ?? current.currentIllness,
		pastIllnesses: patch.pastIllnesses
			? normalizeStringList(patch.pastIllnesses, 20)
			: current.pastIllnesses,
		riskFlags: patch.riskFlags ? normalizeStringList(patch.riskFlags, 20) : current.riskFlags,
		updatedAt: nowIso()
	};

	await dbSaveSessionMemory(next);
	return next;
}

export async function listSessionMemories(): Promise<SessionMemory[]> {
	return dbListSessionMemories();
}

export function buildMemoryContext(memory: SessionMemory, maxChars = 2_000): string {
	const lines = [
		`session_id: ${memory.sessionId}`,
		`root_details: ${memory.rootDetails ? JSON.stringify(memory.rootDetails) : "none"}`,
		`current_illness: ${memory.currentIllness ?? "none"}`,
		`past_illnesses: ${memory.pastIllnesses.length > 0 ? memory.pastIllnesses.join(" | ") : "none"}`,
		`risk_flags: ${memory.riskFlags.length > 0 ? memory.riskFlags.join(", ") : "none"}`,
		`updated_at: ${memory.updatedAt}`
	];

	const raw = lines.join("\n");
	if (raw.length <= maxChars) {
		return raw;
	}

	const clipped = raw.slice(raw.length - maxChars);
	return `[trimmed ${raw.length - clipped.length} chars]\n${clipped}`;
}

export async function resetRagForTests(): Promise<void> {
	dbResetSessionMemoryStore();
}
