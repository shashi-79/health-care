import type { SessionMemory, SessionMemoryPatch } from "@rhc/types/index";
export declare function getSessionMemory(sessionId: string): SessionMemory;
export declare function patchSessionMemory(sessionId: string, patch: SessionMemoryPatch): SessionMemory;
export declare function listSessionMemories(): SessionMemory[];
export declare function buildMemoryContext(memory: SessionMemory, maxChars?: number): string;
export declare function resetRagForTests(): void;
