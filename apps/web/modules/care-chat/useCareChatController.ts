import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CAPTURE_PREVIEW_URL, formatCallDuration } from "./constants";
import { buildDefaultDocumentPreview, buildSeededBrowserState } from "./data/seedData";
import { loadCareChatBrowserState, saveCareChatBrowserState } from "./localBrowserStore";
import { GeminiLiveAudio } from "./gemini-live-audio";
import type {
  ActiveView,
  ChatMessage,
  ContactProfile,
  DeferredPrompt,
  DocumentPreview,
  HistoryItem,
  MediaDocItem,
  MediaLinkItem,
  MediaTab,
  ScheduleItem,
  ScheduleTone,
  CareChatBrowserState
} from "./types";
import type { UiMessage } from "@rhc/types";

const INITIAL_BROWSER_STATE = buildSeededBrowserState();

const MESSAGE_ID_SEED = INITIAL_BROWSER_STATE.chatMessages.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const HISTORY_ID_SEED = INITIAL_BROWSER_STATE.historyItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const SESSION_STORAGE_KEY = "carechat.session.id";

type ScheduleFormState = {
  scheduleType: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
};

type GroupedSchedules = {
  dateNumber: string;
  dayLabel: string;
  items: ScheduleItem[];
};

type ApiChatResponse = {
  ok: boolean;
  triage?: {
    level?: "mild" | "moderate" | "emergency";
  };
  assistant?: {
    role: "assistant";
    content: string;
  };
  bgAnalysis?: {
    executed?: boolean;
    actions?: string[];
    drugHints?: string[];
    shouldStop?: boolean;
  };
};

type ApiHistoryResponse = {
  ok: boolean;
  history?: HistoryItem[];
};

type ApiScheduleResponse = {
  ok: boolean;
  schedules?: ScheduleItem[];
};

type SchedulerTickJob = {
  id: string;
  payload?: Record<string, unknown>;
};

type ApiSchedulerTickResponse = {
  ok: boolean;
  executedJobs?: SchedulerTickJob[];
};

type ApiCallState = {
  sessionId: string;
  status: "idle" | "ringing" | "active" | "ended" | "missed";
  direction: "incoming" | "outgoing" | null;
  contactName: string;
  updatedAt: string;
  startedAtMs: number | null;
  endedAtMs: number | null;
  ringToken: number;
};

type ApiCallStateResponse = {
  ok: boolean;
  call?: ApiCallState;
};

type ApiCallAgentPayload = {
  openingScript?: string;
  firstQuestions?: string[];
  safetyNotes?: string[];
};

type ApiCallInitResponse = {
  ok: boolean;
  usedCallAgent?: boolean;
  call?: {
    provider?: string;
    model?: string;
    persona?: string;
    language?: string;
    memoryContext?: string;
    agent?: ApiCallAgentPayload;
  };
};

type ApiCallAction = "start_outgoing" | "accept" | "end" | "clear";

type MicPermissionState = "unknown" | "granted" | "denied" | "unsupported";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_SCHEDULE_FORM: ScheduleFormState = {
  scheduleType: "Medicine Time",
  title: "",
  date: "",
  time: "",
  duration: "",
  notes: ""
};

function buildClientSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `care-${crypto.randomUUID()}`;
  }
  return `care-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveInitialSessionId() {
  if (typeof window === "undefined") {
    return "default";
  }

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    return stored;
  }

  const generated = buildClientSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

function scheduleToneFromType(scheduleType: string): ScheduleTone {
  const lower = scheduleType.toLowerCase();
  if (lower.includes("medicine")) return "success";
  if (lower.includes("call")) return "warning";
  return "primary";
}

function extractDocumentTitle(messages: ChatMessage[], fallbackTitle: string) {
  const docMessage = messages.find((message) => message.kind === "doc");
  if (docMessage && docMessage.kind === "doc" && docMessage.fileName.trim().length > 0) {
    return docMessage.fileName;
  }

  return fallbackTitle;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    const data = (await response.json()) as T;

    if (!response.ok) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (window.Notification.permission === "default") {
    try {
      return await window.Notification.requestPermission();
    } catch {
      return window.Notification.permission;
    }
  }

  return window.Notification.permission;
}

export function useCareChatController() {
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<MediaTab>("media");

  const [sessionId] = useState(resolveInitialSessionId);
  const [isSyncing, setIsSyncing] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [cameraCaption, setCameraCaption] = useState("");
  const [cameraCaptured, setCameraCaptured] = useState(false);
  const [capturedImageBase64, setCapturedImageBase64] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_BROWSER_STATE.chatMessages);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(INITIAL_BROWSER_STATE.historyItems);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCallIds, setSelectedCallIds] = useState<number[]>([]);

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(INITIAL_BROWSER_STATE.scheduleItems);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(DEFAULT_SCHEDULE_FORM);

  const [contactProfile, setContactProfile] = useState<ContactProfile>(INITIAL_BROWSER_STATE.profile);
  const [mediaImages, setMediaImages] = useState<string[]>(INITIAL_BROWSER_STATE.mediaImages);
  const [mediaDocs, setMediaDocs] = useState<MediaDocItem[]>(INITIAL_BROWSER_STATE.mediaDocs);
  const [mediaLinks, setMediaLinks] = useState<MediaLinkItem[]>(INITIAL_BROWSER_STATE.mediaLinks);
  const [activeDocument, setActiveDocument] = useState<DocumentPreview>(() =>
    buildDefaultDocumentPreview(INITIAL_BROWSER_STATE.mediaDocs[0]?.title)
  );
  const [localDataReady, setLocalDataReady] = useState(false);

  const [callStatus, setCallStatus] = useState("Ringing...");
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isRinging, setIsRinging] = useState(false);
  const [callDirection, setCallDirection] = useState<"incoming" | "outgoing" | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isCallOnHold, setIsCallOnHold] = useState(false);
  const isCallOnHoldRef = useRef(false);
  const [micPermissionState, setMicPermissionState] = useState<MicPermissionState>("unknown");

  const [toastText, setToastText] = useState("Action completed");
  const [toastVisible, setToastVisible] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);

  const messageIdRef = useRef(MESSAGE_ID_SEED);
  const historyIdRef = useRef(HISTORY_ID_SEED);
  const toastTimerRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const callAnswerRef = useRef<number | null>(null);
  const localStateLoadedRef = useRef(false);
  const lastIncomingRingTokenRef = useRef<number | null>(null);
  const lastMissedRingTokenRef = useRef<number | null>(null);
  const isRingingRef = useRef(isRinging);
  const micPermissionStateRef = useRef<MicPermissionState>("unknown");
  const localMicStreamRef = useRef<MediaStream | null>(null);
  const geminiAudioRef = useRef<GeminiLiveAudio | null>(null);
  const geminiInitInFlightRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const schedulerTickInFlightRef = useRef(false);
  const firedScheduleIdsRef = useRef<Set<number>>(new Set());

  const isChatView = activeView === "chat";
  const isCallConnected = callStatus !== "Idle" && callStatus !== "Call ended" && callStatus !== "Missed call";

  const voiceSendIcon = useMemo(() => {
    return messageText.trim().length > 0 ? ">" : "M";
  }, [messageText]);

  const filteredChatMessages = useMemo(() => {
    if (!searchText.trim()) return chatMessages;
    const term = searchText.toLowerCase();
    return chatMessages.filter(
      (m) =>
        (m.kind === "text" && m.text.toLowerCase().includes(term)) ||
        (m.kind === "doc" && m.kind === "doc" && m.fileName.toLowerCase().includes(term)) ||
        (m.kind === "image" && m.caption?.toLowerCase().includes(term)) ||
        (m.kind === "system" && m.text.toLowerCase().includes(term))
    );
  }, [chatMessages, searchText]);

  const groupedSchedules = useMemo<GroupedSchedules[]>(() => {
    const map = new Map<string, GroupedSchedules>();

    for (const item of scheduleItems) {
      const key = `${item.dateNumber}-${item.dayLabel}`;
      const bucket = map.get(key) ?? {
        dateNumber: item.dateNumber,
        dayLabel: item.dayLabel,
        items: []
      };
      bucket.items.push(item);
      map.set(key, bucket);
    }

    return [...map.values()].sort((a, b) => Number(a.dateNumber) - Number(b.dateNumber));
  }, [scheduleItems]);

  const calendarDatePills = useMemo(() => {
    return groupedSchedules.map((group, index) => ({
      key: `${group.dateNumber}-${group.dayLabel}`,
      label: `${group.dayLabel} ${group.dateNumber}`,
      isActive: index === 0
    }));
  }, [groupedSchedules]);

  function hydrateFromBrowserState(nextState: CareChatBrowserState) {
    setContactProfile({ ...nextState.profile });
    setChatMessages(nextState.chatMessages.map((message) => ({ ...message })));
    setHistoryItems(nextState.historyItems.map((item) => ({ ...item })));
    setScheduleItems(nextState.scheduleItems.map((item) => ({ ...item })));
    setMediaImages([...nextState.mediaImages]);
    setMediaDocs(nextState.mediaDocs.map((item) => ({ ...item })));
    setMediaLinks(nextState.mediaLinks.map((item) => ({ ...item })));

    const nextMessageId = nextState.chatMessages.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    messageIdRef.current = Math.max(MESSAGE_ID_SEED, nextMessageId);

    const nextHistoryId = nextState.historyItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    historyIdRef.current = Math.max(HISTORY_ID_SEED, nextHistoryId);

    const fallbackTitle = nextState.mediaDocs[0]?.title ?? "Clinical_Records.pdf";
    const documentTitle = extractDocumentTitle(nextState.chatMessages, fallbackTitle);
    setActiveDocument(buildDefaultDocumentPreview(documentTitle));
  }

  function nextMessageId() {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    return id;
  }

  function nextHistoryId() {
    const id = historyIdRef.current;
    historyIdRef.current += 1;
    return id;
  }

  function showToast(message: string) {
    setToastText(message);
    setToastVisible(true);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  }

  function triggerPickerById(inputId: string) {
    const input = document.getElementById(inputId);
    if (input instanceof HTMLInputElement) {
      input.click();
    }
  }

  function openGalleryPicker() {
    triggerPickerById("gallery-input");
  }

  function openCameraPicker() {
    triggerPickerById("camera-input");
  }

  function openDocumentPicker() {
    triggerPickerById("document-input");
  }

  function closeOverlays() {
    setChatMenuOpen(false);
    setAttachSheetOpen(false);
  }

  function switchView(view: ActiveView) {
    setActiveView(view);
    closeOverlays();
  }

  function appendMessage(message: ChatMessage) {
    setChatMessages((prev) => [...prev, message]);
  }

  function notifyIncomingCall(contactName: string) {
    void (async () => {
      const permission = await ensureNotificationPermission();
      if (permission !== "granted" || typeof window === "undefined") {
        return;
      }

      const notification = new window.Notification("Incoming care call", {
        body: `${contactName} is calling you.`
      });

      notification.onclick = () => {
        window.focus();
        switchView("calling");
      };
    })();
  }

  function stopMicAudioSession() {
    if (geminiAudioRef.current) {
      geminiAudioRef.current.stop();
      geminiAudioRef.current = null;
    }
    geminiInitInFlightRef.current = false;

    const stream = localMicStreamRef.current;
    if (!stream) {
      return;
    }

    for (const track of stream.getTracks()) {
      track.stop();
    }

    localMicStreamRef.current = null;
  }

  function applyMicMutedState(nextMuted: boolean) {
    const stream = localMicStreamRef.current;
    if (!stream) {
      return;
    }

    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
  }

  async function ensureCallAudioSession(options?: { forceRetry?: boolean }) {
    const forceRetry = options?.forceRetry ?? false;

    if (typeof window === "undefined") {
      return false;
    }

    if (localMicStreamRef.current) {
      return true;
    }

    if (!forceRetry && (micPermissionStateRef.current === "denied" || micPermissionStateRef.current === "unsupported")) {
      return false;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setMicPermissionState("unsupported");
      micPermissionStateRef.current = "unsupported";
      showToast("Microphone is not supported in this browser");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localMicStreamRef.current = stream;
      setMicPermissionState("granted");
      micPermissionStateRef.current = "granted";
      applyMicMutedState(isMicMuted);
      showToast("Microphone connected");
      return true;
    } catch {
      setMicPermissionState("denied");
      micPermissionStateRef.current = "denied";
      showToast("Microphone permission denied");
      return false;
    }
  }

  function toggleMicrophone() {
    void (async () => {
      if (!localMicStreamRef.current) {
        const ready = await ensureCallAudioSession({ forceRetry: true });
        if (!ready) {
          return;
        }
      }

      const nextMuted = !isMicMuted;
      setIsMicMuted(nextMuted);
      applyMicMutedState(nextMuted);
      showToast(nextMuted ? "Microphone muted" : "Microphone unmuted");
    })();
  }

  function toggleSpeaker() {
    const nextEnabled = !isSpeakerEnabled;
    setIsSpeakerEnabled(nextEnabled);
    if (geminiAudioRef.current) {
      geminiAudioRef.current.setSpeakerMuted(!nextEnabled || isCallOnHold);
    }
    showToast(nextEnabled ? "Speaker on" : "Speaker off");
  }

  function toggleCallHold() {
    const nextHold = !isCallOnHold;
    setIsCallOnHold(nextHold);
    isCallOnHoldRef.current = nextHold;

    applyMicMutedState(isMicMuted || nextHold);

    if (geminiAudioRef.current) {
      geminiAudioRef.current.setSpeakerMuted(!isSpeakerEnabled || nextHold);
    }

    if (nextHold) {
      setCallStatus("On Hold");
      showToast("Call placed on hold");
    } else {
      setCallStatus(formatCallDuration(callDurationSeconds));
      showToast("Call resumed");
    }
  }

  function applyServerCallState(call: ApiCallState) {
    if (call.status === "ringing") {
      setCallDirection(call.direction);
      setIsRinging(true);
      isRingingRef.current = true;
      setIsMicMuted(false);
      setIsSpeakerEnabled(true);
      setIsCallOnHold(false);
      isCallOnHoldRef.current = false;
      setMicPermissionState("unknown");
      micPermissionStateRef.current = "unknown";
      setCallDurationSeconds(0);
      setCallStatus(call.direction === "incoming" ? "Incoming..." : "Calling...");

      if (call.direction === "incoming" && lastIncomingRingTokenRef.current !== call.ringToken) {
        lastIncomingRingTokenRef.current = call.ringToken;
        showToast(`Incoming call from ${call.contactName}`);
        notifyIncomingCall(call.contactName);
        switchView("calling");
      }

      return;
    }

    if (call.status === "active") {
      setCallDirection(call.direction);
      setIsRinging(false);
      isRingingRef.current = false;

      // Guard: prevent double Gemini Live initialization from polling sync
      if (!geminiInitInFlightRef.current) {
        void ensureCallAudioSession().then((ready) => {
          if (ready && localMicStreamRef.current && !geminiAudioRef.current && !geminiInitInFlightRef.current) {
            geminiInitInFlightRef.current = true;
            try {
              const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
              const callModel = process.env.NEXT_PUBLIC_CALL_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025";
              geminiAudioRef.current = new GeminiLiveAudio(apiKey, callModel);
              geminiAudioRef.current.setSpeakerMuted(!isSpeakerEnabled || isCallOnHold);
              void geminiAudioRef.current.startStream(
                localMicStreamRef.current,
                () => {
                  // Received transcript from model
                },
                (name, args) => {
                  if (name === "request_prescription_info" && args.drugName) {
                    appendMessage({
                      id: nextMessageId(),
                      kind: "system",
                      text: `Background Agent analyzing FDA profile for ${args.drugName}...`
                    });
                    
                    void requestJson("/api/chat", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId,
                        message: `drug: ${args.drugName}`,
                        triageData: {
                          level: "moderate",
                          vitalTriggers: [],
                          isEmergency: false,
                          confidence: 1.0,
                          matchedKeywords: [args.drugName]
                        }
                      })
                    }).catch(() => {});
                  }
                }
              );
            } catch (err) {
              geminiInitInFlightRef.current = false;
              console.error("Failed to start Gemini Live Audio:", err);
            }
          }
        });
      }

      if (!callTimerRef.current) {
        const elapsedSeconds = call.startedAtMs ? Math.max(0, Math.floor((Date.now() - call.startedAtMs) / 1000)) : 0;
        setCallTimerRefAndStatus(elapsedSeconds);
      }

      return;
    }

    if (callTimerRef.current) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setIsRinging(false);
    isRingingRef.current = false;
    setCallDirection(null);
    setCallDurationSeconds(0);
    stopMicAudioSession();

    if (call.status === "missed") {
      setCallStatus("Missed call");

      if (call.direction === "incoming" && lastMissedRingTokenRef.current !== call.ringToken) {
        lastMissedRingTokenRef.current = call.ringToken;

        const missedEntry: HistoryItem = {
          id: nextHistoryId(),
          name: call.contactName,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "missed",
          avatar: contactProfile.avatarUrl
        };

        setHistoryItems((prev) => [missedEntry, ...prev]);
        void persistHistoryEntry(missedEntry);
      }

      if (activeView === "calling") {
        switchView("chat");
      }

      return;
    }

    if (call.status === "ended") {
      setCallStatus("Call ended");
      if (activeView === "calling") {
        switchView("chat");
      }
      return;
    }

    setCallStatus("Idle");
  }

  async function updateCallState(action: ApiCallAction, contactName?: string) {
    const response = await requestJson<ApiCallStateResponse>("/api/call/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        action,
        contactName
      })
    });

    if (!response?.ok || !response.call) {
      return null;
    }

    applyServerCallState(response.call);
    return response.call;
  }

  async function syncCallStateFromServer(nextSessionId: string) {
    const response = await requestJson<ApiCallStateResponse>(
      `/api/call/state?sessionId=${encodeURIComponent(nextSessionId)}`
    );

    if (!response?.ok || !response.call) {
      return;
    }

    applyServerCallState(response.call);
  }

  async function syncHistoryFromServer(nextSessionId: string) {
    const response = await requestJson<ApiHistoryResponse>(
      `/api/care/history?sessionId=${encodeURIComponent(nextSessionId)}`
    );

    if (!response?.ok || !Array.isArray(response.history)) {
      return;
    }

    setHistoryItems(response.history);
    const maxId = response.history.reduce((max, item) => Math.max(max, item.id), 0);
    historyIdRef.current = Math.max(historyIdRef.current, maxId + 1);
  }

  async function syncSchedulesFromServer(nextSessionId: string) {
    const response = await requestJson<ApiScheduleResponse>(
      `/api/care/schedule?sessionId=${encodeURIComponent(nextSessionId)}`
    );

    if (!response?.ok || !Array.isArray(response.schedules)) {
      return;
    }

    setScheduleItems(response.schedules);
  }

  async function syncChatMessagesFromServer(nextSessionId: string) {
    type ApiChatMessagesGetResponse = {
      ok: boolean;
      sessionId: string;
      messages: UiMessage[];
    };

    const response = await requestJson<ApiChatMessagesGetResponse>(
      `/api/chat?sessionId=${encodeURIComponent(nextSessionId)}`
    );

    if (!response?.ok || !Array.isArray(response.messages)) {
      return;
    }

    const messages = response.messages.map((msg: UiMessage, i: number): ChatMessage => {
      let messageTime = "Recent";
      if (msg.createdAt) {
        try {
          const d = new Date(msg.createdAt);
          messageTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch { }
      }

      return {
        id: i,
        kind: "text",
        role: msg.role === "user" ? "patient" : "bot",
        text: msg.content,
        time: messageTime
      };
    });

    if (messages.length > 0) {
      setChatMessages(messages);
    }
  }

  async function syncCareDataFromServer(nextSessionId: string) {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      await Promise.all([
        syncHistoryFromServer(nextSessionId),
        syncSchedulesFromServer(nextSessionId),
        syncCallStateFromServer(nextSessionId),
        syncChatMessagesFromServer(nextSessionId)
      ]);
    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }

  async function sendMessageFromInput() {
    const trimmed = messageText.trim();
    if (!trimmed) {
      showToast("Recording Voice...");
      return;
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    appendMessage({
      id: nextMessageId(),
      kind: "text",
      role: "patient",
      text: trimmed,
      time: now
    });

    setMessageText("");

    const response = await requestJson<ApiChatResponse>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        text: trimmed
      })
    });

    if (!response?.ok || !response.assistant?.content) {
      showToast("Message saved locally. Server sync pending.");
      return;
    }

    appendMessage({
      id: nextMessageId(),
      kind: "text",
      role: "bot",
      text: response.assistant.content,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });

    if (response.triage?.level === "emergency") {
      showToast("Emergency signal detected. Please seek urgent care.");
    }
  }

  function sendMockDoc(fileName = "New_Upload.pdf") {
    const meta = "1 Page • 500 KB • PDF";

    appendMessage({
      id: nextMessageId(),
      kind: "doc",
      role: "patient",
      fileName,
      meta,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });

    setMediaDocs((prev) => {
      if (prev.some((item) => item.title === fileName)) {
        return prev;
      }
      return [{ id: Date.now(), title: fileName, meta }, ...prev];
    });

    setActiveDocument(buildDefaultDocumentPreview(fileName));
    showToast("Document Sent");
  }

  function updateContactProfile(profile: Partial<ContactProfile>) {
    setContactProfile((prev) => {
      const next = { ...prev, ...profile };
      return next;
    });
    showToast("Profile updated successfully");
  }

  function notifyUpload(kind: string, file: File) {
    void requestJson("/api/ingest/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        mimeType: file.type || undefined,
        fileName: file.name,
        sizeBytes: file.size,
        text: `${kind} uploaded: ${file.name}`
      })
    });
  }

  function consolidateCallForBg(summary: string) {
    if (!summary.trim()) {
      return;
    }

    void requestJson("/api/bg/consolidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        transcript: summary
      })
    });
  }

  function handleFileSelect(kind: "Photo" | "Gallery Media" | "Document", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    closeOverlays();
    showToast(`Selected ${kind}: ${file.name}`);

    if (kind === "Document") {
      sendMockDoc(file.name);
    } else {
      if (file.type.startsWith("image/")) {
        const objectUrl = window.URL.createObjectURL(file);
        setMediaImages((prev) => [objectUrl, ...prev].slice(0, 30));
      }

      appendMessage({
        id: nextMessageId(),
        kind: "text",
        role: "patient",
        text: `${kind} uploaded: ${file.name}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
    }

    notifyUpload(kind, file);
    event.target.value = "";
  }

  function openDocument() {
    const fallbackTitle = mediaDocs[0]?.title ?? "Clinical_Records.pdf";
    const documentTitle = extractDocumentTitle(chatMessages, fallbackTitle);
    setActiveDocument(buildDefaultDocumentPreview(documentTitle));
    switchView("document");
  }

  function openDocumentByName(fileName: string) {
    setActiveDocument(buildDefaultDocumentPreview(fileName));
    switchView("document");
  }

  function closeDocument() {
    switchView("chat");
  }

  function openImage() {
    showToast("Opening Image Fullscreen...");
  }

  function setCallTimerRefAndStatus(initialSeconds = 0) {
    if (callTimerRef.current) {
      window.clearInterval(callTimerRef.current);
    }

    setCallDurationSeconds(initialSeconds);
    setCallStatus(formatCallDuration(initialSeconds));

    callTimerRef.current = window.setInterval(() => {
      setCallDurationSeconds((prev) => {
        const next = prev + 1;
        if (!isCallOnHoldRef.current) {
          setCallStatus(formatCallDuration(next));
        }
        return next;
      });
    }, 1000);
  }

  async function acceptCurrentCall() {
    if (!isRingingRef.current) {
      return;
    }

    setIsRinging(false);
    isRingingRef.current = false;
    setCallTimerRefAndStatus(0);
    await updateCallState("accept");
    void ensureCallAudioSession();
  }

  function handlePrimaryCallAction() {
    if (isRinging) {
      void acceptCurrentCall();
      return;
    }

    showToast("Call controls active");
  }

  function generateCallLink() {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/?sessionId=${encodeURIComponent(sessionId)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast("Call link copied to clipboard");
      }).catch(() => {
        showToast("Failed to copy link");
      });
    }
  }

  function startCall() {
    if (isCallConnected) {
      switchView("calling");
      return;
    }

    setCallStatus("Calling...");
    setCallDurationSeconds(0);
    setIsRinging(true);
    isRingingRef.current = true;
    setIsMicMuted(false);
    setIsSpeakerEnabled(true);
    setIsCallOnHold(false);
    isCallOnHoldRef.current = false;
    setMicPermissionState("unknown");
    micPermissionStateRef.current = "unknown";
    setCallDirection("outgoing");
    geminiInitInFlightRef.current = false;
    switchView("calling");

    if (callTimerRef.current) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (callAnswerRef.current) {
      window.clearTimeout(callAnswerRef.current);
    }

    // Parallelized novel flow: Ring & Register immediately, fetch brief concurrently
    // This strictly eliminates the 5s+ latency bottleneck before the call connects
    void updateCallState("start_outgoing", contactProfile.name);

    // Auto-accept after a short realistic ring delay immediately
    if (callAnswerRef.current) {
      window.clearTimeout(callAnswerRef.current);
    }
    callAnswerRef.current = window.setTimeout(() => {
      void acceptCurrentCall();
    }, 1500);

    // Fetch the AI agent brief entirely in the background
    void (async () => {
      try {
        const init = await requestJson<ApiCallInitResponse>("/api/call/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });

        const openingScript = init?.call?.agent?.openingScript?.trim();
        if (openingScript) {
          appendMessage({
            id: nextMessageId(),
            kind: "system",
            text: `Call Brief • ${openingScript}`
          });
        }

        if (init?.usedCallAgent) {
          showToast("AI call agent brief ready");
        }
      } catch (err) {
        console.error("Failed to fetch initial brief for call", err);
      }
    })();
  }

  async function persistHistoryEntry(entry: HistoryItem) {
    const response = await requestJson<ApiHistoryResponse>("/api/care/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        entry
      })
    });

    if (response?.ok && Array.isArray(response.history)) {
      setHistoryItems(response.history);
    }
  }

  function endCall() {
    if (callTimerRef.current) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (callAnswerRef.current) {
      window.clearTimeout(callAnswerRef.current);
      callAnswerRef.current = null;
    }

    const minutes = Math.floor(callDurationSeconds / 60);
    const seconds = callDurationSeconds % 60;

    appendMessage({
      id: nextMessageId(),
      kind: "system",
      text: `Call Ended • ${minutes}m ${seconds}s`
    });

    const declinedIncoming = isRinging && callDirection === "incoming" && callDurationSeconds === 0;

    if (!declinedIncoming) {
      const callEntry: HistoryItem = {
        id: nextHistoryId(),
        name: contactProfile.name,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: callDirection === "incoming" ? "in" : "out",
        avatar: contactProfile.avatarUrl
      };

      setHistoryItems((prev) => [callEntry, ...prev]);
      void persistHistoryEntry(callEntry);
    }

    void updateCallState("end");

    // Only consolidate for BG agent when the call was actually connected.
    // Declined/missed calls with zero duration don't need BG processing.
    if (!declinedIncoming && callDurationSeconds > 0) {
      const callSummary = `${callDirection === "incoming" ? "Incoming" : "Outgoing"} call with ${contactProfile.name} lasted ${minutes}m ${seconds}s.`;
      consolidateCallForBg(callSummary);
    }

    setIsRinging(false);
    isRingingRef.current = false;
    stopMicAudioSession();
    setCallDirection(null);
    setCallDurationSeconds(0);
    setIsCallOnHold(false);
    isCallOnHoldRef.current = false;
    switchView("chat");
  }

  function openCamera() {
    setCameraCaptured(false);
    setCameraCaption("");
    switchView("camera");
  }

  function captureImage(base64?: string) {
    if (typeof base64 === "string") {
      setCapturedImageBase64(base64);
    }
    setCameraCaptured(true);
  }

  function closeCamera() {
    setCameraCaptured(false);
    setCapturedImageBase64("");
    setCameraCaption("");
    switchView("chat");
  }

  function sendCapturedImage() {
    const finalImage = capturedImageBase64 || CAPTURE_PREVIEW_URL;
    
    appendMessage({
      id: nextMessageId(),
      kind: "image",
      role: "patient",
      imageUrl: finalImage,
      caption: cameraCaption.trim() || undefined,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });

    setMediaImages((prev) => [finalImage, ...prev].slice(0, 30));

    void (async () => {
      const uploadRes = await requestJson<{ ok: boolean }>("/api/ingest/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mimeType: "image/jpeg",
          fileName: "captured-image.jpg",
          base64Image: finalImage.includes(",") ? finalImage.split(",")[1] : finalImage,
          text: cameraCaption.trim() || undefined
        })
      });

      if (uploadRes?.ok) {
        const chatResponse = await requestJson<ApiChatResponse>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            text: ""
          })
        });

        if (chatResponse?.ok && chatResponse.assistant?.content) {
          appendMessage({
            id: nextMessageId(),
            kind: "text",
            role: "bot",
            text: chatResponse.assistant.content,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          });
        }
      }
    })();

    closeCamera();
  }

  function openHistory() {
    setSelectionMode(false);
    setSelectedCallIds([]);
    switchView("history");
  }

  function closeHistory() {
    switchView("chat");
  }

  function showProfile() {
    switchView("profile");
  }

  function closeProfile() {
    switchView("chat");
  }

  function showMedia() {
    setMediaTab("media");
    switchView("media");
  }

  function closeMedia() {
    switchView("chat");
  }

  function toggleBulkSelect() {
    const next = !selectionMode;
    setSelectionMode(next);
    if (!next) {
      setSelectedCallIds([]);
    }
  }

  function handleHistoryItemClick(id: number) {
    if (!selectionMode) return;

    setSelectedCallIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((itemId) => itemId !== id);
      }
      return [...prev, id];
    });
  }

  function clearChatHistory() {
    setChatMessages([]);
    showToast("Chat history cleared");

    void (async () => {
      await requestJson(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
    })();
  }

  function deleteSingleHistory(id: number) {
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Call log deleted");

    void (async () => {
      const response = await requestJson<ApiHistoryResponse>("/api/care/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ids: [id]
        })
      });

      if (response?.ok && Array.isArray(response.history)) {
        setHistoryItems(response.history);
      }
    })();
  }

  function deleteSelectedCalls() {
    if (selectedCallIds.length === 0) {
      setSelectionMode(false);
      return;
    }

    setHistoryItems((prev) => prev.filter((item) => !selectedCallIds.includes(item.id)));
    showToast(`${selectedCallIds.length} item(s) deleted`);

    void (async () => {
      const response = await requestJson<ApiHistoryResponse>("/api/care/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ids: selectedCallIds
        })
      });

      if (response?.ok && Array.isArray(response.history)) {
        setHistoryItems(response.history);
      }
    })();

    setSelectedCallIds([]);
    setSelectionMode(false);
  }

  function clearAllHistoryCalls() {
    setHistoryItems([]);
    showToast(`Call history cleared`);
    setSelectionMode(false);
    setSelectedCallIds([]);

    void (async () => {
      const response = await requestJson<ApiHistoryResponse>("/api/care/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          clearAll: true
        })
      });

      if (response?.ok && Array.isArray(response.history)) {
        setHistoryItems(response.history);
      }
    })();
  }

  function setScheduleFormField(field: keyof ScheduleFormState, value: string) {
    setScheduleForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function saveSchedule() {
    const title = scheduleForm.title.trim();
    const time = scheduleForm.time.trim();

    if (!title || !time) {
      showToast("Title and time are required.");
      return;
    }

    const tone = scheduleToneFromType(scheduleForm.scheduleType);

    // Compute date fields from the date picker (or default to today)
    const dateStr = scheduleForm.date || todayDateString();
    const dateObj = new Date(dateStr + "T00:00:00");
    const dateNumber = String(dateObj.getDate());
    const dayLabel = DAY_LABELS[dateObj.getDay()];

    // Build full ISO datetime for precise bg worker matching
    // time is in HH:MM format from the time input
    const scheduleDate = new Date(`${dateStr}T${time}:00`).toISOString();

    // Format time for display (e.g. "14:30" → "2:30 PM")
    const [hh, mm] = time.split(":").map(Number);
    const ampm = hh >= 12 ? "PM" : "AM";
    const displayHour = hh % 12 || 12;
    const displayTime = `${displayHour}:${String(mm).padStart(2, "0")} ${ampm}`;

    const localItem: ScheduleItem = {
      id: Date.now(),
      scheduleType: scheduleForm.scheduleType,
      title,
      time: displayTime,
      duration: scheduleForm.duration.trim(),
      notes: scheduleForm.notes.trim(),
      dateNumber,
      dayLabel,
      tone,
      status: "pending",
      scheduleDate
    };

    setScheduleItems((prev) => [localItem, ...prev]);
    setAddScheduleOpen(false);
    closeOverlays();
    setScheduleForm(DEFAULT_SCHEDULE_FORM);
    showToast("Schedule Saved Successfully!");

    void (async () => {
      const response = await requestJson<ApiScheduleResponse>("/api/care/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          schedule: {
            scheduleType: localItem.scheduleType,
            title: localItem.title,
            time: localItem.time,
            duration: localItem.duration,
            notes: localItem.notes,
            dateNumber: localItem.dateNumber,
            dayLabel: localItem.dayLabel,
            tone: localItem.tone,
            scheduleDate: localItem.scheduleDate
          }
        })
      });

      if (response?.ok && Array.isArray(response.schedules)) {
        setScheduleItems(response.schedules);
      }
    })();
  }

  function toggleScheduleStatus(id: number, checked: boolean) {
    const status = checked ? "done" : "pending";

    if (checked) {
      firedScheduleIdsRef.current.add(id);
    } else {
      firedScheduleIdsRef.current.delete(id);
    }

    setScheduleItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          status
        };
      })
    );

    void (async () => {
      const response = await requestJson<ApiScheduleResponse>("/api/care/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          id,
          status
        })
      });

      if (response?.ok && Array.isArray(response.schedules)) {
        setScheduleItems(response.schedules);
      }
    })();
  }

  async function triggerInstall() {
    closeOverlays();

    if (!deferredPrompt) {
      showToast("App installation not supported or already installed.");
      return;
    }

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      showToast("Install prompt could not be shown.");
    }

    setDeferredPrompt(null);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const localState = await loadCareChatBrowserState();

        if (cancelled) {
          return;
        }

        hydrateFromBrowserState(localState);
      } catch {
        if (cancelled) {
          return;
        }
      } finally {
        if (!cancelled) {
          localStateLoadedRef.current = true;
          setLocalDataReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    isRingingRef.current = isRinging;
  }, [isRinging]);

  useEffect(() => {
    micPermissionStateRef.current = micPermissionState;
  }, [micPermissionState]);

  useEffect(() => {
    if (!localDataReady) {
      return;
    }

    void syncCareDataFromServer(sessionId);

    const callPollId = window.setInterval(() => {
      void syncCallStateFromServer(sessionId);
    }, 4000);

    const carePollId = window.setInterval(() => {
      void syncHistoryFromServer(sessionId);
      void syncSchedulesFromServer(sessionId);
      void syncChatMessagesFromServer(sessionId);
    }, 24000);

    function handleFocus() {
      void syncCareDataFromServer(sessionId);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncCareDataFromServer(sessionId);
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(callPollId);
      window.clearInterval(carePollId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // This effect should restart only when session identity/readiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDataReady, sessionId]);

  // Scheduler tick worker: fetches due jobs for this session and updates schedule state.
  useEffect(() => {
    if (!localDataReady) {
      return;
    }

    const TICK_MS = 15_000;

    async function checkDueSchedules() {
      if (schedulerTickInFlightRef.current) {
        return;
      }

      schedulerTickInFlightRef.current = true;

      try {
        const response = await requestJson<ApiSchedulerTickResponse>("/api/scheduler/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            nowMs: Date.now()
          })
        });

        if (!response?.ok || !Array.isArray(response.executedJobs) || response.executedJobs.length === 0) {
          return;
        }

        const dueScheduleIds = response.executedJobs
          .map((job) => {
            const scheduleId = job.payload?.scheduleId;
            return typeof scheduleId === "number" ? scheduleId : null;
          })
          .filter((scheduleId): scheduleId is number => scheduleId !== null);

        if (dueScheduleIds.length === 0) {
          return;
        }

        const dueIdSet = new Set(dueScheduleIds);
        const dueItems: ScheduleItem[] = [];

        setScheduleItems((prev) => {
          let changed = false;

          const next = prev.map((item) => {
            if (!dueIdSet.has(item.id) || item.status === "done") {
              return item;
            }

            changed = true;
            dueItems.push(item);
            return { ...item, status: "done" as const };
          });

          return changed ? next : prev;
        });

        if (dueItems.length === 0) {
          return;
        }

        for (const item of dueItems) {
          if (!firedScheduleIdsRef.current.has(item.id)) {
            firedScheduleIdsRef.current.add(item.id);
            showToast(`⏰ ${item.title} — ${item.notes || item.scheduleType}`);

            const permission = await ensureNotificationPermission();
            if (permission === "granted" && typeof window !== "undefined") {
              new window.Notification(`Schedule: ${item.title}`, {
                body: `${item.scheduleType} • ${item.time}${item.notes ? " — " + item.notes : ""}`
              });
            }

            if (item.scheduleType.toLowerCase().includes("call")) {
              window.setTimeout(() => startCall(), 1500);
            }
          }

          void (async () => {
            await requestJson<ApiScheduleResponse>("/api/care/schedule", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, id: item.id, status: "done" })
            });
          })();

        }
      } finally {
        schedulerTickInFlightRef.current = false;
      }
    }

    // Run immediately on mount, then on interval
    void checkDueSchedules();
    const tickId = window.setInterval(() => {
      void checkDueSchedules();
    }, TICK_MS);

    return () => window.clearInterval(tickId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDataReady, sessionId]);

  useEffect(() => {
    if (!localStateLoadedRef.current) {
      return;
    }

    void saveCareChatBrowserState({
      profile: contactProfile,
      chatMessages,
      historyItems,
      scheduleItems,
      mediaImages,
      mediaDocs,
      mediaLinks
    });
  }, [contactProfile, chatMessages, historyItems, mediaDocs, mediaImages, mediaLinks, scheduleItems]);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as unknown as DeferredPrompt);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    const searchInput = document.getElementById("search-input");
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const textarea = document.getElementById("chat-input");
    if (!textarea) return;
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;

    if (messageText.trim().length === 0) {
      textarea.style.height = "40px";
    }
  }, [messageText]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      if (chatMenuOpen && !event.target.closest("#chat-menu") && !event.target.closest("#menu-trigger")) {
        setChatMenuOpen(false);
      }

      if (attachSheetOpen && !event.target.closest("#attach-sheet") && !event.target.closest("#attach-trigger")) {
        setAttachSheetOpen(false);
      }
    }

    if (chatMenuOpen || attachSheetOpen) {
      document.addEventListener("click", onDocumentClick);
    }

    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [attachSheetOpen, chatMenuOpen]);

  useEffect(() => {
    return () => {
      stopMicAudioSession();
      if (callTimerRef.current) {
        window.clearInterval(callTimerRef.current);
      }
      if (callAnswerRef.current) {
        window.clearTimeout(callAnswerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    sessionId,
    localDataReady,
    activeView,
    chatMenuOpen,
    attachSheetOpen,
    showSearch,
    calendarOpen,
    addScheduleOpen,
    mediaTab,
    messageText,
    cameraCaption,
    cameraCaptured,
    capturedImageBase64,
    chatMessages,
    searchText,
    filteredChatMessages,
    historyItems,
    selectionMode,
    selectedCallIds,
    scheduleItems,
    groupedSchedules,
    calendarDatePills,
    scheduleForm,
    contactProfile,
    mediaImages,
    mediaDocs,
    mediaLinks,
    activeDocument,
    callStatus,
    isRinging,
    callDirection,
    isMicMuted,
    isSpeakerEnabled,
    isCallOnHold,
    isCallConnected,
    micPermissionState,
    isSyncing,
    toastText,
    toastVisible,
    deferredPrompt,
    isChatView,
    voiceSendIcon,
    setShowSearch,
    setSearchText,
    setCalendarOpen,
    setAddScheduleOpen,
    setMediaTab,
    setMessageText,
    setCameraCaption,
    setChatMenuOpen,
    setAttachSheetOpen,
    setScheduleFormField,
    switchView,
    closeOverlays,
    openDocument,
    openDocumentByName,
    closeDocument,
    openImage,
    handlePrimaryCallAction,
    toggleMicrophone,
    toggleSpeaker,
    toggleCallHold,
    generateCallLink,
    startCall,
    endCall,
    openCamera,
    captureImage,
    closeCamera,
    sendCapturedImage,
    openHistory,
    closeHistory,
    updateContactProfile,
    showProfile,
    closeProfile,
    showMedia,
    closeMedia,
    toggleBulkSelect,
    handleHistoryItemClick,
    deleteSingleHistory,
    deleteSelectedCalls,
    clearAllHistoryCalls,
    clearChatHistory,
    saveSchedule,
    toggleScheduleStatus,
    triggerInstall,
    handleFileSelect,
    openGalleryPicker,
    openCameraPicker,
    openDocumentPicker,
    sendMessageFromInput
  };
}

export type CareChatViewModel = ReturnType<typeof useCareChatController>;
