export type ActiveView = "chat" | "calling" | "history" | "profile";

export type HistoryType = "in" | "out" | "missed";

export type HistoryItem = {
  id: number;
  name: string;
  time: string;
  type: HistoryType;
  avatar: string;
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
};
