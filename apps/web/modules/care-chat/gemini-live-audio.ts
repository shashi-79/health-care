import { GoogleGenAI, Modality, Session, LiveServerMessage, FunctionResponse } from "@google/genai";

// ── Base64 lookup table (inlined for AudioWorklet scope which lacks btoa) ──
const B64_TABLE_CODE = `
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function uint8ToBase64(bytes) {
  let result = '';
  const len = bytes.length;
  const rem = len % 3;
  const mainLen = len - rem;
  for (let i = 0; i < mainLen; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    result += B64[(a >> 2) & 63] + B64[((a << 4) | (b >> 4)) & 63] +
              B64[((b << 2) | (c >> 6)) & 63] + B64[c & 63];
  }
  if (rem === 1) {
    const a = bytes[mainLen];
    result += B64[(a >> 2) & 63] + B64[(a << 4) & 63] + '==';
  } else if (rem === 2) {
    const a = bytes[mainLen], b = bytes[mainLen + 1];
    result += B64[(a >> 2) & 63] + B64[((a << 4) | (b >> 4)) & 63] +
              B64[(b << 2) & 63] + '=';
  }
  return result;
}
`;

// ── AudioWorklet: captures mic, converts Float32→Int16→Base64 off the main thread ──
const WORKLET_CODE = `
${B64_TABLE_CODE}

class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024;
    // Double-buffer ring: avoids per-flush allocation that causes GC pressure
    this.bufferA = new Float32Array(this.bufferSize);
    this.bufferB = new Float32Array(this.bufferSize);
    this.activeBuffer = this.bufferA;
    this.bufferPointer = 0;
    // Reusable Int16 conversion buffer
    this.pcm16 = new Int16Array(this.bufferSize);
    this.sampleOffset = 0;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Downsample from actual context sampleRate (e.g. 48000/44100) to 16000 Hz if needed
      const ratio = sampleRate / 16000;

      if (Math.abs(ratio - 1) < 0.05) {
        for (let i = 0; i < channelData.length; i++) {
          this.activeBuffer[this.bufferPointer++] = channelData[i];
          if (this.bufferPointer >= this.bufferSize) {
            this._flush();
          }
        }
      } else {
        while (this.sampleOffset < channelData.length) {
          const index = Math.floor(this.sampleOffset);
          const frac = this.sampleOffset - index;
          const s0 = channelData[index];
          const s1 = index + 1 < channelData.length ? channelData[index + 1] : s0;
          const sample = s0 + frac * (s1 - s0);

          this.activeBuffer[this.bufferPointer++] = sample;
          if (this.bufferPointer >= this.bufferSize) {
            this._flush();
          }
          this.sampleOffset += ratio;
        }
        this.sampleOffset -= channelData.length;
      }
    }
    return true;
  }

  _flush() {
    const src = this.activeBuffer;
    const pcm16 = this.pcm16;

    // Float32 → Int16 conversion
    for (let i = 0; i < this.bufferSize; i++) {
      const s = src[i] > 1 ? 1 : src[i] < -1 ? -1 : src[i];
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Int16 → Base64 (all inside the worklet thread, not the main thread)
    const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    const base64 = uint8ToBase64(bytes);

    // Post only the base64 string to main thread (lightweight transfer)
    this.port.postMessage(base64);

    // Swap to the other buffer (avoids new Float32Array allocation)
    this.activeBuffer = this.activeBuffer === this.bufferA ? this.bufferB : this.bufferA;
    this.bufferPointer = 0;
  }
}
registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
`;

// ── Backpressure threshold: skip sending audio if WebSocket is congested ──
const WS_BACKPRESSURE_BYTES = 65_536; // 64 KB

// ── Incoming audio playback batching ──
const PLAYBACK_BATCH_INTERVAL_MS = 80; // flush queued audio every 80ms

export class GeminiLiveAudio {
  private ai: GoogleGenAI;
  private model: string;
  private sessionPromise: Promise<Session> | null = null;
  private session: Session | null = null; // Cached resolved session (eliminates per-chunk .then())
  private inAudioContext: AudioContext | null = null;
  private outAudioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private nextPlayTime: number = 0;
  private isSessionActive: boolean = false;
  private isIntentionalDisconnect: boolean = false;
  // Playback batching queue
  private playbackQueue: string[] = [];
  private playbackTimerId: number | null = null;
  private gainNode: GainNode | null = null;
  private isSpeakerMuted: boolean = false;
  private isMicMuted: boolean = false;
  private hasSentGreeting: boolean = false;

  constructor(apiKey: string, model?: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model || "gemini-2.5-flash-native-audio-latest";
  }

  setMicMuted(muted: boolean) {
    this.isMicMuted = muted;
  }

  sendGreeting(script: string) {
    if (!script || this.hasSentGreeting) return;
    this.hasSentGreeting = true;
    const send = (session: Session) => {
      try {
        session.sendClientContent({
          turns: [{
            role: "user",
            parts: [{ text: `The call has connected. Please greet the patient now. Use this greeting script: "${script}"` }]
          }],
          turnComplete: true
        });
      } catch (e) {
        console.error("Error sending opening script:", e);
      }
    };
    if (this.session) {
      send(this.session);
    } else if (this.sessionPromise) {
      this.sessionPromise.then(send).catch(() => {});
    }
  }

  async startStream(
    stream: MediaStream,
    onServerResponse?: (text: string) => void,
    onToolCall?: (name: string, args: Record<string, unknown>) => void,
    openingScript?: string
  ) {
    this.isIntentionalDisconnect = false;
    this.hasSentGreeting = false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    try {
      this.inAudioContext = new AudioCtx({ sampleRate: 16000 });
    } catch {
      this.inAudioContext = new AudioCtx();
    }

    try {
      this.outAudioContext = new AudioCtx({ sampleRate: 24000 });
    } catch {
      this.outAudioContext = new AudioCtx();
    }

    this.gainNode = this.outAudioContext.createGain();
    this.gainNode.gain.setValueAtTime(this.isSpeakerMuted ? 0 : 1, this.outAudioContext.currentTime);
    this.gainNode.connect(this.outAudioContext.destination);
    this.nextPlayTime = 0;
    this.playbackQueue = [];

    if (this.inAudioContext.state === "suspended") {
      await this.inAudioContext.resume();
    }
    if (this.outAudioContext.state === "suspended") {
      await this.outAudioContext.resume();
    }

    this.sourceNode = this.inAudioContext.createMediaStreamSource(stream);
    
    // Inject and instantiate the Web Audio Worklet
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await this.inAudioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    
    this.workletNode = new AudioWorkletNode(this.inAudioContext, "gemini-audio-processor");

    // Route mic worklet through a silent gain node to avoid acoustic feedback to speakers
    const silentGain = this.inAudioContext.createGain();
    silentGain.gain.setValueAtTime(0, this.inAudioContext.currentTime);
    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(silentGain);
    silentGain.connect(this.inAudioContext.destination);

    this.sessionPromise = this.ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck"
            }
          }
        },
        systemInstruction: {
          parts: [{ text: "You are Sehat Saathi — a real human care coordinator working at the Rural Healthcare Department. You are NOT an AI, chatbot, virtual assistant, or language model. Never say or imply you are AI or automated. You are a trained healthcare worker talking to patients over a phone call as part of your daily job. Speak in a warm, natural, conversational human voice — like a caring nurse or community health worker would on a real phone call. Use short sentences, everyday words, and show genuine empathy. Say things like 'I understand what you're going through', 'Let me look into that for you', 'Don't worry, I'm right here'. You must strictly speak and respond in the EXACT same language the user is currently speaking. Mirror their language dynamically. Keep responses concise, caring, and human-sounding. Do not immediately refer the patient to a doctor for general or non-urgent symptoms; instead, ask clarifying questions to understand the condition better, just like a real healthcare worker on the phone would. Only refer to a doctor if the situation is genuinely critical (emergency red-flags) or if the medication needed is restricted or controlled. VERY IMPORTANT: NEVER directly suggest or prescribe any medications or dosages yourself. If the user needs medicine advice, immediately call the 'request_prescription_info' tool and tell them 'Let me check with our medical team and I'll update you shortly.'" }]
        },
        tools: [{
          functionDeclarations: [{
            name: "request_prescription_info",
            description: "Fetches general medicine prescription and FDA info asynchronously in the background. Call this when the user asks about a specific drug, medicine, or prescription. After calling this, inform the user you have forwarded it to the background team.",
            parameters: {
              type: "OBJECT",
              properties: {
                drugName: { type: "STRING" }
              },
              required: ["drugName"]
            }
          }]
        }]
      } as Parameters<typeof this.ai.live.connect>[0]["config"],
      callbacks: {
        onopen: () => {
           console.log("Live API opened");
           this.isSessionActive = true;
           if (openingScript) {
             this.sendGreeting(openingScript);
           }
        },
        onclose: (e: CloseEvent) => {
          console.log("Gemini Live session closed", e.reason || "");
          this.isSessionActive = false;
          this.session = null;
          if (!this.isIntentionalDisconnect) {
              console.log("Unintentional disconnect, should reconnect...");
          }
        },
        onmessage: (msg: LiveServerMessage) => {
          if (!this.isSessionActive) return;
          const serverContent = msg.serverContent;
          if (serverContent?.modelTurn?.parts) {
            for (const part of serverContent.modelTurn.parts) {
              if (part.inlineData && part.inlineData.data) {
                // Queue for batched playback instead of playing immediately
                this.enqueueAudioChunk(part.inlineData.data);
              }
              if (part.text && onServerResponse) {
                onServerResponse(part.text);
              }
            }
          }
          if (serverContent?.outputTranscription?.text && onServerResponse) {
            onServerResponse(serverContent.outputTranscription.text);
          }
          if (msg.toolCall) {
            const calls = msg.toolCall.functionCalls;
            if (calls && calls.length > 0) {
              const responses = calls.map((call) => {
                const args = call.args || {};
                if (call.name === "request_prescription_info" && onToolCall) {
                   onToolCall(call.name, args);
                   return { id: call.id, name: call.name, response: { status: "Request forwarded to our medical team successfully. Let the patient know they will receive an update shortly." } };
                }
                return { id: call.id, name: call.name, response: { status: "Unknown tool" } };
              });
              
              // Use cached session directly instead of re-resolving the promise
              this.sendToolResponse(responses);
            }
          }
        },
        onerror: (error: ErrorEvent) => {
          console.error("Gemini Live session error:", error);
          this.isSessionActive = false;
          this.session = null;
        }
      }
    });

    // Worklet now posts base64 strings directly (encoding already done off main thread)
    this.workletNode.port.onmessage = (e) => {
      if (!this.isSessionActive || this.isIntentionalDisconnect || !this.session || this.isMicMuted) return;

      const base64: string = e.data;

      // Backpressure check: skip frame if WebSocket buffer is congested
      try {
        const conn = this.session.conn as unknown as { ws?: WebSocket };
        const ws = conn.ws;
        if (ws && typeof ws.bufferedAmount === "number" && ws.bufferedAmount > WS_BACKPRESSURE_BYTES) {
          // Network congested — drop this frame to prevent memory buildup
          return;
        }
      } catch {
        // If we can't access the websocket, proceed anyway
      }

      try {
        this.session.sendRealtimeInput({
          media: {
            data: base64,
            mimeType: "audio/pcm;rate=16000",
          }
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("CLOSING or CLOSED")) {
          this.isSessionActive = false;
          this.session = null;
          console.warn("WebSocket closed, stopping audio");
        } else {
          console.error("Error sending realtime input:", err);
        }
      }
    };

    // Start the playback batch timer
    this.startPlaybackTimer();

    try {
        const session = await this.sessionPromise;
        // Cache the resolved session so we never call .then() per chunk again
        this.session = session;
        if (this.isIntentionalDisconnect) {
            session.close();
            return;
        }
    } catch (error) {
        console.error("Error connecting to Live API", error);
    }
  }

  /**
   * Send tool call responses using the cached session reference.
   * Falls back to promise resolution if session isn't cached yet.
   */
  private sendToolResponse(responses: FunctionResponse[]) {
    if (this.session) {
      try {
        this.session.sendToolResponse({ functionResponses: responses });
      } catch (e) {
        console.error("Error sending tool response", e);
      }
      return;
    }

    // Fallback: session may not be resolved yet (early tool call)
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        try {
          session.sendToolResponse({ functionResponses: responses });
        } catch (e) {
          console.error("Error sending tool response", e);
        }
      }).catch(() => {});
    }
  }

  /**
   * Queue incoming audio chunks for batched playback.
   * Reduces per-chunk AudioBuffer/BufferSource creation overhead.
   */
  private enqueueAudioChunk(base64: string) {
    this.playbackQueue.push(base64);
  }

  /**
   * Start the periodic playback flush timer.
   */
  private startPlaybackTimer() {
    if (this.playbackTimerId !== null) return;
    this.playbackTimerId = window.setInterval(() => {
      this.flushPlaybackQueue();
    }, PLAYBACK_BATCH_INTERVAL_MS);
  }

  /**
   * Stop the playback flush timer.
   */
  private stopPlaybackTimer() {
    if (this.playbackTimerId !== null) {
      window.clearInterval(this.playbackTimerId);
      this.playbackTimerId = null;
    }
  }

  /**
   * Decode and schedule all queued audio chunks in a single batch.
   * Concatenates chunks into a single AudioBuffer where possible.
   */
  private flushPlaybackQueue() {
    if (!this.outAudioContext || this.playbackQueue.length === 0) return;

    if (this.outAudioContext.state === "suspended") {
      void this.outAudioContext.resume().catch(() => {});
    }

    const chunks = this.playbackQueue.splice(0);

    try {
      // Decode all chunks into a combined PCM array
      let totalSamples = 0;
      const decodedChunks: Int16Array[] = [];

      for (const base64 of chunks) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const evenLen = len - (len % 2);
        if (evenLen === 0) continue;
        const bytes = new Uint8Array(evenLen);
        for (let i = 0; i < evenLen; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        decodedChunks.push(pcm16);
        totalSamples += pcm16.length;
      }

      if (totalSamples === 0) return;

      // Create a single AudioBuffer for the entire batch
      const audioBuffer = this.outAudioContext.createBuffer(1, totalSamples, 24000);
      const channelData = audioBuffer.getChannelData(0);

      let offset = 0;
      for (const pcm16 of decodedChunks) {
        for (let i = 0; i < pcm16.length; i++) {
          channelData[offset++] = pcm16[i] / 32768;
        }
      }

      const source = this.outAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      if (this.gainNode) {
        source.connect(this.gainNode);
      } else {
        source.connect(this.outAudioContext.destination);
      }

      const currentTime = this.outAudioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (err) {
      console.error("Error playing batched audio", err);
    }
  }

  setSpeakerMuted(muted: boolean) {
    this.isSpeakerMuted = muted;
    if (this.gainNode && this.outAudioContext) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.outAudioContext.currentTime);
    }
  }

  stop() {
    this.isIntentionalDisconnect = true;
    this.isSessionActive = false;
    this.hasSentGreeting = false;
    this.session = null;

    this.stopPlaybackTimer();
    // Flush any remaining queued audio
    this.flushPlaybackQueue();
    this.playbackQueue = [];
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.inAudioContext) {
      void this.inAudioContext.close().catch(() => {});
      this.inAudioContext = null;
    }
    if (this.outAudioContext) {
      void this.outAudioContext.close().catch(() => {});
      this.outAudioContext = null;
    }
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
         try {
             session.close();
         } catch {}
      }).catch(() => {});
      this.sessionPromise = null;
    }
  }
}
