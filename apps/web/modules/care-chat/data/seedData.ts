import type {
  CareChatBrowserState,
  ContactProfile,
  HistoryItem,
  ChatMessage
} from "../types";

const SEEDED_PROFILE: ContactProfile = {
  id: 1,
  name: "User",
  statusText: "Ready",
  avatarUrl: "",
  phone: "",
  dobLabel: "",
  ageLabel: "",
  weightLabel: "",
  heightLabel: "",
  medicalHistory: ""
};

const SEEDED_MESSAGES: ChatMessage[] = [];

const SEEDED_HISTORY: HistoryItem[] = [];

function cloneMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.kind === "system") {
      return { ...message };
    }
    return { ...message };
  });
}

export function buildSeededBrowserState(): CareChatBrowserState {
  return {
    profile: { ...SEEDED_PROFILE },
    chatMessages: cloneMessages(SEEDED_MESSAGES),
    historyItems: SEEDED_HISTORY.map((item) => ({ ...item }))
  };
}
