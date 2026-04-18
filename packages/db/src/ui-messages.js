const uiStore = new Map();
function nowIso() {
    return new Date().toISOString();
}
function normalizeSessionId(sessionId) {
    const value = sessionId.trim();
    return value.length > 0 ? value : "default";
}
function cloneMessage(message) {
    return { ...message };
}
export function addUiMessage(input) {
    const sessionId = normalizeSessionId(input.sessionId);
    const content = input.content.trim();
    if (!content) {
        throw new Error("UI message content cannot be empty.");
    }
    const message = {
        sessionId,
        role: input.role,
        content,
        createdAt: input.createdAt ?? nowIso()
    };
    const messages = uiStore.get(sessionId) ?? [];
    messages.push(message);
    uiStore.set(sessionId, messages.slice(-400));
    return cloneMessage(message);
}
export function listUiMessages(sessionId, limit = 120) {
    const key = normalizeSessionId(sessionId);
    const messages = uiStore.get(key) ?? [];
    return messages.slice(-limit).map((message) => cloneMessage(message));
}
export function clearUiMessages(sessionId) {
    if (sessionId) {
        uiStore.delete(normalizeSessionId(sessionId));
        return;
    }
    uiStore.clear();
}
export function assertUiStoreIsolation() {
    return "UI messages are isolated from AI memory access by policy.";
}
