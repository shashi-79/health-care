import { describe, it, expect, beforeEach } from "vitest";
import {
  addUiMessage,
  listUiMessages,
  clearUiMessages,
  dbGetSessionMemory,
  dbSaveSessionMemory,
  dbGetCallState,
  dbSaveCallState
} from "@rhc/db";

describe("Database / Persistence Layer", () => {
  const testSessionId = `test_session_${Date.now()}`;

  beforeEach(async () => {
    await clearUiMessages(testSessionId);
  });

  it("stores and retrieves UI messages correctly", async () => {
    const msg1 = addUiMessage({
      sessionId: testSessionId,
      role: "user",
      content: "Hello, I feel feverish."
    });
    expect(msg1.content).toBe("Hello, I feel feverish.");

    const msg2 = addUiMessage({
      sessionId: testSessionId,
      role: "assistant",
      content: "I have recorded your fever symptoms."
    });
    expect(msg2.role).toBe("assistant");

    const messages = await listUiMessages(testSessionId);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe("Hello, I feel feverish.");
    expect(messages[1].content).toBe("I have recorded your fever symptoms.");
  });

  it("clears UI messages for a given session", async () => {
    addUiMessage({
      sessionId: testSessionId,
      role: "user",
      content: "To be cleared."
    });

    await clearUiMessages(testSessionId);
    const messages = await listUiMessages(testSessionId);
    expect(messages.length).toBe(0);
  });

  it("persists and updates session memory", async () => {
    const memory = await dbGetSessionMemory(testSessionId);
    expect(memory.sessionId).toBe(testSessionId);
    expect(memory.pastIllnesses).toEqual([]);

    await dbSaveSessionMemory({
      sessionId: testSessionId,
      currentIllness: "Mild headache",
      pastIllnesses: ["Common cold", "Allergies"],
      riskFlags: ["moderate_symptom_pattern"],
      updatedAt: new Date().toISOString()
    });

    const updated = await dbGetSessionMemory(testSessionId);
    expect(updated.currentIllness).toBe("Mild headache");
    expect(updated.pastIllnesses).toContain("Common cold");
    expect(updated.riskFlags).toContain("moderate_symptom_pattern");
  });

  it("manages call state transitions", async () => {
    const state = await dbGetCallState(testSessionId);
    expect(state.status).toBe("idle");

    await dbSaveCallState({
      sessionId: testSessionId,
      status: "ringing",
      direction: "outgoing",
      contactName: "Mohan",
      updatedAt: new Date().toISOString(),
      startedAtMs: null,
      endedAtMs: null,
      ringToken: 1
    });

    const active = await dbGetCallState(testSessionId);
    expect(active.status).toBe("ringing");
    expect(active.direction).toBe("outgoing");
  });
});
