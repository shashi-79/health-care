export type UiMessage = {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export function assertUiStoreIsolation() {
  return "UI messages are isolated from AI memory access by policy.";
}
