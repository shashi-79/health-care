import type { ChatMessage, HistoryItem } from "./types";

export const INITIAL_MESSAGES: ChatMessage[] = [
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
    id: 4,
    kind: "image",
    role: "patient",
    imageUrl: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=400&q=80",
    caption: "Here is my current prescription",
    time: "10:10 AM"
  }
];

export const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 1,
    name: "Mohan",
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

export const MEDIA_IMAGE_GRID = [
  "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1542736667-069246bdbc6d?auto=format&fit=crop&w=200&q=80"
];

export const CAPTURE_PREVIEW_URL =
  "https://images.unsplash.com/photo-1542736667-069246bdbc6d?auto=format&fit=crop&w=400&q=80";

export function formatCallDuration(seconds: number) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}
