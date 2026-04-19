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
  name: "Mohan",
  statusText: "Care chat ready",
  avatarUrl: "https://i.pravatar.cc/150?img=32",
  phone: "+1 234 567 8900",
  dobLabel: "12 May 1985",
  ageLabel: "39 yrs",
  weightLabel: "76 kg",
  heightLabel: "178 cm",
  medicalHistory:
    "Mild hypertension diagnosed in 2021. No known allergies. Occasional asthma during pollen season. Previous appendectomy (2015)."
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
    title: fileName ?? "Lab_Results_Oct.pdf",
    summaryTitle: ".pdf Text-",
    summaryBody: "Here is the extracted text and analysis from the patient document:",
    tableRows: [
      {
        label: "Hemoglobin",
        result: "14.2 g/dL",
        range: "13.8-17.2"
      },
      {
        label: "Cholesterol",
        result: "210 mg/dL",
        range: "< 200",
        isAlert: true
      }
    ]
  };
}
