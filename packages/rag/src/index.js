const sessionMemoryStore = new Map();
function nowIso() {
    return new Date().toISOString();
}
function normalizeSessionId(sessionId) {
    const value = sessionId.trim();
    return value.length > 0 ? value : "default";
}
function normalizeStringList(input, maxItems) {
    if (!input)
        return [];
    const normalized = input
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, maxItems);
    return [...new Set(normalized)];
}
function cloneMemory(memory) {
    return {
        ...memory,
        rootDetails: memory.rootDetails ? { ...memory.rootDetails } : undefined,
        pastIllnesses: [...memory.pastIllnesses],
        riskFlags: [...memory.riskFlags]
    };
}
function buildDefaultMemory(sessionId) {
    return {
        sessionId,
        pastIllnesses: [],
        riskFlags: [],
        updatedAt: nowIso()
    };
}
export function getSessionMemory(sessionId) {
    const key = normalizeSessionId(sessionId);
    const existing = sessionMemoryStore.get(key);
    if (existing) {
        return cloneMemory(existing);
    }
    const created = buildDefaultMemory(key);
    sessionMemoryStore.set(key, created);
    return cloneMemory(created);
}
export function patchSessionMemory(sessionId, patch) {
    const current = getSessionMemory(sessionId);
    const next = {
        ...current,
        rootDetails: patch.rootDetails ?? current.rootDetails,
        currentIllness: patch.currentIllness ?? current.currentIllness,
        pastIllnesses: patch.pastIllnesses
            ? normalizeStringList(patch.pastIllnesses, 20)
            : current.pastIllnesses,
        riskFlags: patch.riskFlags ? normalizeStringList(patch.riskFlags, 20) : current.riskFlags,
        updatedAt: nowIso()
    };
    sessionMemoryStore.set(next.sessionId, cloneMemory(next));
    return cloneMemory(next);
}
export function listSessionMemories() {
    return [...sessionMemoryStore.values()].map((memory) => cloneMemory(memory));
}
export function buildMemoryContext(memory, maxChars = 2_000) {
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
export function resetRagForTests() {
    sessionMemoryStore.clear();
}
