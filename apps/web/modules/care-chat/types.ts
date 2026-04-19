export type ActiveView = "chat" | "document" | "calling" | "camera" | "history" | "media" | "profile";

export type MediaTab = "media" | "docs" | "links";

export type HistoryType = "in" | "out" | "missed";

export type HistoryItem = {
  id: number;
  name: string;
  time: string;
  type: HistoryType;
  avatar: string;
};

export type ScheduleTone = "primary" | "success" | "warning";

export type ScheduleStatus = "pending" | "done";

export type ScheduleItem = {
  id: number;
  scheduleType: string;
  title: string;
  time: string;
  duration: string;
  notes: string;
  dateNumber: string;
  dayLabel: string;
  tone: ScheduleTone;
  status: ScheduleStatus;
  scheduleDate?: string;
};

export type ContactProfile = {
  id: number;
  name: string;
  statusText: string;
  avatarUrl: string;
  phone: string;
  dobLabel: string;
  ageLabel: string;
  weightLabel: string;
  heightLabel: string;
  medicalHistory: string;
};

export type MediaDocItem = {
  id: number;
  title: string;
  meta: string;
};

export type MediaLinkItem = {
  id: number;
  title: string;
  url: string;
};

export type DocumentPreview = {
  title: string;
  summaryTitle: string;
  summaryBody: string;
  tableRows: Array<{
    label: string;
    result: string;
    range: string;
    isAlert?: boolean;
  }>;
};

export type ChatMessage =
  | {
      id: number;
      kind: "text";
      role: "bot" | "patient";
      text: string;
      time: string;
    }
  | {
      id: number;
      kind: "doc";
      role: "bot" | "patient";
      fileName: string;
      meta: string;
      time: string;
    }
  | {
      id: number;
      kind: "image";
      role: "bot" | "patient";
      imageUrl: string;
      caption?: string;
      time: string;
    }
  | {
      id: number;
      kind: "system";
      text: string;
    };

export type DeferredPrompt = {
  prompt: () => Promise<void> | void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type CareChatBrowserState = {
  profile: ContactProfile;
  chatMessages: ChatMessage[];
  historyItems: HistoryItem[];
  scheduleItems: ScheduleItem[];
  mediaImages: string[];
  mediaDocs: MediaDocItem[];
  mediaLinks: MediaLinkItem[];
};
