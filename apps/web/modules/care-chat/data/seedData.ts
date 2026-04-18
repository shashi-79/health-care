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
  name: "John Doe",
  statusText: "Online",
  avatarUrl: "https://i.pravatar.cc/150?img=32",
  phone: "+1 234 567 8900",
  dobLabel: "12 May 1985",
  ageLabel: "39 yrs",
  weightLabel: "76 kg",
  heightLabel: "178 cm",
  medicalHistory:
    "Mild hypertension diagnosed in 2021. No known allergies. Occasional asthma during pollen season. Previous appendectomy (2015)."
};

const SEEDED_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    kind: "text",
    role: "bot",
    text: "Hello John, your lab results are ready.",
    time: "10:00 AM"
  },
  {
    id: 2,
    kind: "text",
    role: "patient",
    text: "Thank you. Could you send them over?",
    time: "10:02 AM"
  },
  {
    id: 3,
    kind: "doc",
    role: "bot",
    fileName: "Lab_Results_Oct.pdf",
    meta: "4 Pages • 1.2 MB • PDF",
    time: "10:05 AM"
  },
  {
    id: 4,
    kind: "image",
    role: "patient",
    imageUrl: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=400&q=80",
    caption: "Here is my current prescription",
    time: "10:10 AM"
  },
  {
    id: 5,
    kind: "system",
    text: "Call Ended • 3m 14s"
  },
  {
    id: 6,
    kind: "text",
    role: "bot",
    text: "Please continue medication for five days and hydrate well.",
    time: "10:18 AM"
  }
];

const SEEDED_HISTORY: HistoryItem[] = [
  {
    id: 1,
    name: "John Doe",
    time: "10:30 AM",
    type: "out",
    avatar: "https://i.pravatar.cc/150?img=32"
  },
  {
    id: 2,
    name: "Dr. Smith",
    time: "Yesterday",
    type: "missed",
    avatar: "https://i.pravatar.cc/150?img=11"
  },
  {
    id: 3,
    name: "Jane Roe",
    time: "Monday",
    type: "in",
    avatar: "https://i.pravatar.cc/150?img=5"
  }
];

const SEEDED_SCHEDULES: ScheduleItem[] = [
  {
    id: 1,
    scheduleType: "Consultancy Time",
    title: "Clinical Consultation",
    time: "10:00 AM",
    duration: "30 mins",
    notes: "Audio follow-up",
    dateNumber: "9",
    dayLabel: "Mon",
    tone: "primary",
    status: "pending"
  },
  {
    id: 2,
    scheduleType: "Medicine Time",
    title: "Review Lab Results",
    time: "1:30 PM",
    duration: "15 mins",
    notes: "John Doe",
    dateNumber: "9",
    dayLabel: "Mon",
    tone: "success",
    status: "done"
  },
  {
    id: 3,
    scheduleType: "Call Time",
    title: "Follow-up Call",
    time: "9:00 AM",
    duration: "20 mins",
    notes: "Pending",
    dateNumber: "10",
    dayLabel: "Tue",
    tone: "warning",
    status: "pending"
  }
];

const SEEDED_MEDIA_IMAGES = [
  "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1542736667-069246bdbc6d?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=200&q=80"
];

const SEEDED_MEDIA_DOCS: MediaDocItem[] = [
  {
    id: 1,
    title: "Lab_Results_Oct.pdf",
    meta: "1.2 MB • PDF"
  },
  {
    id: 2,
    title: "Clinical_Records.pdf",
    meta: "2 MB • PDF Document"
  }
];

const SEEDED_MEDIA_LINKS: MediaLinkItem[] = [
  {
    id: 1,
    title: "Medical Consultation Room",
    url: "https://zoom.us/j/medical-consult"
  },
  {
    id: 2,
    title: "WHO Hypertension Basics",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension"
  }
];

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
