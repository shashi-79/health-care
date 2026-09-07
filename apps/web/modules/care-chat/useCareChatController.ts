import { useEffect, useMemo, useRef, useState } from "react";
import { CAPTURE_PREVIEW_URL, formatCallDuration } from "./constants";
import { buildSeededBrowserState } from "./data/seedData";
import { loadCareChatBrowserState, saveCareChatBrowserState } from "./localBrowserStore";
import { GeminiLiveAudio } from "./gemini-live-audio";
import type {
  ActiveView,
  ChatMessage,
  ContactProfile,
  DeferredPrompt,
  HistoryItem,
  CareChatBrowserState
} from "./types";
import type { UiMessage } from "@rhc/types";

const INITIAL_BROWSER_STATE = buildSeededBrowserState();

const MESSAGE_ID_SEED = INITIAL_BROWSER_STATE.chatMessages.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const HISTORY_ID_SEED = INITIAL_BROWSER_STATE.historyItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
const SESSION_STORAGE_KEY = "carechat.session.id";

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
  uiMessageCount?: number;
};

type ApiHistoryResponse = {
  ok: boolean;
  history?: HistoryItem[];
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

function buildClientSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `care-${crypto.randomUUID()}`;
  }
  return `care-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSameMessage(a: ChatMessage, b: ChatMessage): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "system" && b.kind === "system") {
    return a.text.trim() === b.text.trim();
  }
  if (a.kind === "text" && b.kind === "text") {
    return a.role === b.role && a.text.trim() === b.text.trim();
  }
  if (a.kind === "image" && b.kind === "image") {
    return a.role === b.role && a.imageUrl === b.imageUrl && (a.caption || "") === (b.caption || "");
  }
  return false;
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sessionId] = useState(resolveInitialSessionId);
  const [isSyncing, setIsSyncing] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_BROWSER_STATE.chatMessages);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(INITIAL_BROWSER_STATE.historyItems);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCallIds, setSelectedCallIds] = useState<number[]>([]);

  const [contactProfile, setContactProfile] = useState<ContactProfile>(INITIAL_BROWSER_STATE.profile);
  const [localDataReady, setLocalDataReady] = useState(false);

  const [callStatus, setCallStatus] = useState("Idle");
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
  const callOpeningScriptRef = useRef("");
  const syncInFlightRef = useRef(false);

  const lastCallUpdatedAtRef = useRef("");
  const lastMsgCountRef = useRef(-1);
  const lastHistoryCountRef = useRef(-1);

  const isChatView = activeView === "chat";
  const isCallConnected = callStatus !== "Idle" && callStatus !== "Call ended" && callStatus !== "Missed call";

  const isCallConnectedRef = useRef(isCallConnected);
  useEffect(() => {
    isCallConnectedRef.current = isCallConnected;
  }, [isCallConnected]);

  const chatMessagesRef = useRef<ChatMessage[]>(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);





  const filteredChatMessages = useMemo(() => {
    if (!searchText.trim()) return chatMessages;
    const term = searchText.toLowerCase();
    return chatMessages.filter(
      (m) =>
        (m.kind === "text" && m.text.toLowerCase().includes(term)) ||
        (m.kind === "image" && m.caption?.toLowerCase().includes(term)) ||
        (m.kind === "system" && m.text.toLowerCase().includes(term))
    );
  }, [chatMessages, searchText]);

  function hydrateFromBrowserState(nextState: CareChatBrowserState) {
    setContactProfile({ ...nextState.profile });

    // Deduplicate any consecutive identical messages from stored state
    const cleanMessages: ChatMessage[] = [];
    for (const msg of nextState.chatMessages) {
      if (cleanMessages.length > 0) {
        const prev = cleanMessages[cleanMessages.length - 1];
        if (isSameMessage(prev, msg)) {
          continue;
        }
      }
      cleanMessages.push({ ...msg });
    }

    setChatMessages(cleanMessages);
    setHistoryItems(nextState.historyItems.map((item) => ({ ...item })));

    const nextMessageId = cleanMessages.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    messageIdRef.current = Math.max(MESSAGE_ID_SEED, nextMessageId);

    const nextHistoryId = nextState.historyItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    historyIdRef.current = Math.max(HISTORY_ID_SEED, nextHistoryId);
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

  function closeOverlays() {
    setChatMenuOpen(false);
  }

  function switchView(view: ActiveView) {
    setActiveView(view);
    closeOverlays();
  }

  function appendMessage(message: ChatMessage) {
    setChatMessages((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (isSameMessage(last, message)) {
          return prev;
        }
      }
      return [...prev, message];
    });
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
    if (typeof window === "undefined") {
      return false;
    }

    if (localMicStreamRef.current) {
      const tracks = localMicStreamRef.current.getAudioTracks();
      if (tracks.length > 0 && tracks[0].readyState === "live") {
        return true;
      }
      stopMicAudioSession();
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setMicPermissionState("unsupported");
      micPermissionStateRef.current = "unsupported";
      showToast("Microphone is not supported in this browser");
      return false;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      }

      localMicStreamRef.current = stream;
      setMicPermissionState("granted");
      micPermissionStateRef.current = "granted";
      applyMicMutedState(isMicMuted);
      showToast("Microphone connected");
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      const isDenied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      setMicPermissionState(isDenied ? "denied" : "unknown");
      micPermissionStateRef.current = isDenied ? "denied" : "unknown";
      showToast(isDenied ? "Microphone permission denied. Please allow mic in browser." : "Could not connect microphone.");
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
      if (geminiAudioRef.current) {
        geminiAudioRef.current.setMicMuted(nextMuted);
      }
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
      if (call.direction === "incoming" && lastIncomingRingTokenRef.current !== call.ringToken) {
        lastIncomingRingTokenRef.current = call.ringToken;

        showToast(`Incoming call from ${call.contactName}`);
        notifyIncomingCall(call.contactName);
        switchView("calling");
      }

      setCallDirection(call.direction);
      setIsRinging(true);
      isRingingRef.current = true;
      setIsMicMuted(false);
      setIsSpeakerEnabled(true);
      setIsCallOnHold(false);
      isCallOnHoldRef.current = false;
      setCallDurationSeconds(0);
      setCallStatus(call.direction === "incoming" ? "Incoming..." : "Calling...");

      return;
    }

    if (call.status === "active") {
      setCallDirection(call.direction);
      setIsRinging(false);
      isRingingRef.current = false;

      // Guard: prevent double Gemini Live initialization from polling sync
      if (!geminiInitInFlightRef.current && !geminiAudioRef.current) {
        geminiInitInFlightRef.current = true;
        void ensureCallAudioSession().then((ready) => {
          if (!ready) {
            geminiInitInFlightRef.current = false;
            endCall();
            return;
          }
          if (ready && localMicStreamRef.current && !geminiAudioRef.current) {
            try {
              const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
              const callModel = process.env.NEXT_PUBLIC_CALL_MODEL || "gemini-2.5-flash-native-audio-latest";
              geminiAudioRef.current = new GeminiLiveAudio(apiKey, callModel);
              geminiAudioRef.current.setSpeakerMuted(!isSpeakerEnabled || isCallOnHold);
              const scriptToUse = callOpeningScriptRef.current || "Hello, this is Sehat Saathi from the Rural Healthcare Department. I am your care coordinator. How are you feeling today?";
              void geminiAudioRef.current.startStream(
                localMicStreamRef.current,
                (text) => {
                  if (text && text.trim()) {
                    appendMessage({
                      id: nextMessageId(),
                      kind: "text",
                      role: "bot",
                      text: text.trim(),
                      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    });
                  }
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
                },
                scriptToUse
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
        window.setTimeout(() => {
          switchView("chat");
        }, 800);
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
    lastCallUpdatedAtRef.current = response.call.updatedAt || "";
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
    lastHistoryCountRef.current = response.history.length;
  }

  function applyChatMessagesSync(messagesList: UiMessage[]) {
    lastMsgCountRef.current = messagesList.length;

    function mapServerMessageToChat(msg: UiMessage, index: number): ChatMessage {
      let messageTime = "Recent";
      if (msg.createdAt) {
        try {
          const d = new Date(msg.createdAt);
          messageTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch { }
      }

      const role = msg.role === "user" ? "patient" : "bot";

      if (msg.content.startsWith("[Image Uploaded")) {
        const captionMatch = msg.content.match(/\]\s*(.*)$/);
        const caption = captionMatch ? captionMatch[1].trim() : undefined;
        const imageUrl = CAPTURE_PREVIEW_URL;
        return {
          id: index,
          kind: "image",
          role,
          imageUrl,
          caption: caption || undefined,
          time: messageTime
        };
      }

      if (msg.content.startsWith("Gallery Media uploaded:") || msg.content.startsWith("Photo uploaded:")) {
        const parts = msg.content.split(":");
        const fileName = parts[1] ? parts[1].trim() : "image.jpg";
        const imageUrl = CAPTURE_PREVIEW_URL;
        return {
          id: index,
          kind: "image",
          role,
          imageUrl,
          caption: fileName,
          time: messageTime
        };
      }

      return {
        id: index,
        kind: "text",
        role,
        text: msg.content,
        time: messageTime
      };
    }

    const L = chatMessagesRef.current;
    const result: ChatMessage[] = [];
    let serverIdx = 0;

    for (let i = 0; i < L.length; i++) {
      const local = L[i];
      if (local.kind === "system") {
        // Keep system messages (call logs, briefs, status alerts) at their exact chronological position
        result.push(local);
      } else if (serverIdx < messagesList.length) {
        // If there's a corresponding server message, use the server message
        result.push(mapServerMessageToChat(messagesList[serverIdx], serverIdx));
        serverIdx++;
      } else if (local.role === "patient") {
        // Only keep an in-flight optimistic patient message if it's not yet on the server
        result.push(local);
      }
      // Note: do not push local bot messages when serverIdx >= messagesList.length as bot messages are server-authoritative
    }

    // Append any remaining new server messages (e.g. new bot replies)
    while (serverIdx < messagesList.length) {
      result.push(mapServerMessageToChat(messagesList[serverIdx], serverIdx));
      serverIdx++;
    }

    // Deduplicate any consecutive identical messages
    const deduplicated: ChatMessage[] = [];
    for (const msg of result) {
      if (deduplicated.length > 0) {
        const prev = deduplicated[deduplicated.length - 1];
        if (isSameMessage(prev, msg)) {
          continue;
        }
      }
      deduplicated.push(msg);
    }

    const renumberedFinalMessages = deduplicated.map((m, idx) => ({
      ...m,
      id: idx
    }));

    setChatMessages(renumberedFinalMessages);
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

    applyChatMessagesSync(response.messages);
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

    if (typeof response.uiMessageCount === "number") {
      lastMsgCountRef.current = response.uiMessageCount;
    }

    if (response.triage?.level === "emergency") {
      showToast("Emergency signal detected. Please seek urgent care.");
    }
  }

  function updateContactProfile(profile: Partial<ContactProfile>) {
    setContactProfile((prev) => {
      const next = { ...prev, ...profile };
      return next;
    });
    showToast("Profile updated successfully");
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

    const hasAudio = await ensureCallAudioSession({ forceRetry: true });
    if (!hasAudio) {
      setIsRinging(false);
      isRingingRef.current = false;
      await updateCallState("end");
      showToast("Cannot connect call: Microphone permission is required.");
      if (activeView === "calling") {
        switchView("chat");
      }
      return;
    }

    setIsRinging(false);
    isRingingRef.current = false;
    setCallTimerRefAndStatus(0);
    await updateCallState("accept");
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

    // Immediately request mic session within the user click gesture context
    void ensureCallAudioSession({ forceRetry: true });

    setCallStatus("Calling...");
    setCallDurationSeconds(0);
    setIsRinging(true);
    isRingingRef.current = true;
    setIsMicMuted(false);
    setIsSpeakerEnabled(true);
    setIsCallOnHold(false);
    isCallOnHoldRef.current = false;
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
          callOpeningScriptRef.current = openingScript;
          appendMessage({
            id: nextMessageId(),
            kind: "system",
            text: `Call Brief • ${openingScript}`
          });
          if (geminiAudioRef.current) {
            geminiAudioRef.current.sendGreeting(openingScript);
          }
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
    callOpeningScriptRef.current = "";
    setCallDirection(null);
    setCallDurationSeconds(0);
    setIsCallOnHold(false);
    isCallOnHoldRef.current = false;
    setCallStatus("Call ended");

    if (activeView === "calling") {
      window.setTimeout(() => {
        switchView("chat");
      }, 800);
    }
  }



  function openImage(url: string) {
    setPreviewImageUrl(url);
  }

  function closeImagePreview() {
    setPreviewImageUrl(null);
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
    if (typeof window !== "undefined" && navigator.permissions && typeof navigator.permissions.query === "function") {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
        const stateMap: Record<PermissionState, MicPermissionState> = {
          granted: "granted",
          denied: "denied",
          prompt: "unknown"
        };
        const mapped = stateMap[status.state] || "unknown";
        setMicPermissionState(mapped);
        micPermissionStateRef.current = mapped;

        status.onchange = () => {
          const updated = stateMap[status.state] || "unknown";
          setMicPermissionState(updated);
          micPermissionStateRef.current = updated;
        };
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!localDataReady) {
      return;
    }

    // Initial sync
    void syncCareDataFromServer(sessionId);

    let isMounted = true;
    const abortController = new AbortController();

    async function poll() {
      while (isMounted) {
        try {
          const url = `/api/care/sync?sessionId=${encodeURIComponent(sessionId)}` +
            `&callUpdatedAt=${encodeURIComponent(lastCallUpdatedAtRef.current)}` +
            `&msgCount=${lastMsgCountRef.current}` +
            `&historyCount=${lastHistoryCountRef.current}`;

          const res = await requestJson<{
            ok: boolean;
            hasChanges?: boolean;
            callState?: ApiCallState;
            messages?: UiMessage[];
            history?: HistoryItem[];
          }>(url, { signal: abortController.signal });

          if (!isMounted) break;

          if (res && res.ok && res.hasChanges) {
            if (res.callState) {
              applyServerCallState(res.callState);
              lastCallUpdatedAtRef.current = res.callState.updatedAt || "";
            }
            if (res.messages) {
              applyChatMessagesSync(res.messages);
            }
            if (res.history) {
              setHistoryItems(res.history);
              const maxId = res.history.reduce((max, item) => Math.max(max, item.id), 0);
              historyIdRef.current = Math.max(historyIdRef.current, maxId + 1);
              lastHistoryCountRef.current = res.history.length;
            }
          }

          // Sleep very briefly before the next poll to prevent tight loops
          await new Promise(r => setTimeout(r, 1000));
        } catch {
          if (!isMounted) break;
          // In case of network errors or aborts, wait a bit before retrying
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    }

    void poll();

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
      isMounted = false;
      abortController.abort();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // This effect should restart only when session identity/readiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDataReady, sessionId]);

  useEffect(() => {
    if (!localStateLoadedRef.current) {
      return;
    }

    void saveCareChatBrowserState({
      profile: contactProfile,
      chatMessages,
      historyItems
    });
  }, [contactProfile, chatMessages, historyItems]);

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
    }

    if (chatMenuOpen) {
      document.addEventListener("click", onDocumentClick);
    }

    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [chatMenuOpen]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (isCallConnectedRef.current) {
        fetch("/api/call/state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            action: "end",
          }),
          keepalive: true,
        });
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (isCallConnectedRef.current) {
        fetch("/api/call/state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            action: "end",
          }),
          keepalive: true,
        });
      }

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
  }, [sessionId]);

  return {
    sessionId,
    localDataReady,
    activeView,
    chatMenuOpen,
    showSearch,
    messageText,
    chatMessages,
    searchText,
    filteredChatMessages,
    historyItems,
    selectionMode,
    selectedCallIds,
    contactProfile,
    callStatus,
    isRinging,
    callDirection,
    isMicMuted,
    isSpeakerEnabled,
    isCallOnHold,
    isCallConnected,
    micPermissionState,
    isSyncing,
    previewImageUrl,
    toastText,
    toastVisible,
    deferredPrompt,
    isChatView,
    setShowSearch,
    setSearchText,
    setMessageText,
    setChatMenuOpen,
    switchView,
    closeOverlays,
    openImage,
    handlePrimaryCallAction,
    toggleMicrophone,
    toggleSpeaker,
    toggleCallHold,
    generateCallLink,
    startCall,
    endCall,
    closeImagePreview,
    openHistory,
    closeHistory,
    updateContactProfile,
    showProfile,
    closeProfile,
    toggleBulkSelect,
    handleHistoryItemClick,
    deleteSingleHistory,
    deleteSelectedCalls,
    clearAllHistoryCalls,
    clearChatHistory,
    triggerInstall,
    sendMessageFromInput
  };
}

export type CareChatViewModel = ReturnType<typeof useCareChatController>;
