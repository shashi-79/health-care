import type {
  CareChatBrowserState,
  ContactProfile,
  DocumentPreview,
  HistoryItem,
  MediaDocItem,
  MediaLinkItem,
  ScheduleItem,
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

const SEEDED_SCHEDULES: ScheduleItem[] = [];

const SEEDED_MEDIA_IMAGES: string[] = [];

const SEEDED_MEDIA_DOCS: MediaDocItem[] = [];

const SEEDED_MEDIA_LINKS: MediaLinkItem[] = [];

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
    historyItems: SEEDED_HISTORY.map((item) => ({ ...item })),
    scheduleItems: SEEDED_SCHEDULES.map((item) => ({ ...item })),
    mediaImages: [...SEEDED_MEDIA_IMAGES],
    mediaDocs: SEEDED_MEDIA_DOCS.map((item) => ({ ...item })),
    mediaLinks: SEEDED_MEDIA_LINKS.map((item) => ({ ...item }))
  };
}

export function buildDefaultDocumentPreview(fileName?: string): DocumentPreview {
  return {
    title: fileName ?? "Document",
    summaryTitle: "Summary",
    summaryBody: "Extracted document text...",
    tableRows: []
  };
}
