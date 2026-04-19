import { GoogleGenAI, Modality } from "@google/genai";

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
    this.bufferSize = 4096;
    // Double-buffer ring: avoids per-flush allocation that causes GC pressure
    this.bufferA = new Float32Array(this.bufferSize);
    this.bufferB = new Float32Array(this.bufferSize);
    this.activeBuffer = this.bufferA;
    this.bufferPointer = 0;
    // Reusable Int16 conversion buffer
    this.pcm16 = new Int16Array(this.bufferSize);
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.activeBuffer[this.bufferPointer++] = channelData[i];
        if (this.bufferPointer >= this.bufferSize) {
          this._flush();
        }
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
  private sessionPromise: Promise<any> | null = null;
  private session: any | null = null; // Cached resolved session (eliminates per-chunk .then())
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

  constructor(apiKey: string, model?: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model || "gemini-2.5-flash-native-audio-preview-12-2025";
  }

  async startStream(
    stream: MediaStream,
    onServerResponse?: (text: string) => void,
    onToolCall?: (name: string, args: Record<string, any>) => void
  ) {
    this.isIntentionalDisconnect = false;
    this.inAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    this.outAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    this.nextPlayTime = 0;
    this.playbackQueue = [];

    if (this.inAudioContext.state === 'suspended') {
      await this.inAudioContext.resume();
    }

    this.sourceNode = this.inAudioContext.createMediaStreamSource(stream);
    
    // Inject and instantiate the Web Audio Worklet
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.inAudioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    
    this.workletNode = new AudioWorkletNode(this.inAudioContext, 'gemini-audio-processor');

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.inAudioContext.destination);

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
          parts: [{ text: "You are a helpful rural healthcare assistant. Respond naturally in conversation. You must strictly speak and respond in the EXACT same language that the user is currently speaking to you in. Mirror their language dynamically. Keep responses concise and caring. VERY IMPORTANT: NEVER directly suggest or prescribe any medications or precise dosages yourself. If the user needs medicine recommendations, immediately call the 'request_prescription_info' tool so the background physician agent can provide the exact low-dosage suggestions." }]
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
      } as any,
      callbacks: {
        onopen: () => {
           console.log("Live API opened");
           this.isSessionActive = true;
        },
        onclose: (e: any) => {
          console.log("Gemini Live session closed", e?.reason || "");
          this.isSessionActive = false;
          this.session = null;
          if (!this.isIntentionalDisconnect) {
              console.log("Unintentional disconnect, should reconnect...");
          }
        },
        onmessage: (msg: any) => {
          if (!this.isSessionActive) return;
          const serverContent = msg?.serverContent;
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
          } else if (msg.toolCall) {
            const calls = msg.toolCall.functionCalls;
            if (calls && calls.length > 0) {
              const responses = calls.map((call: any) => {
                const args = call.args || {};
                if (call.name === "request_prescription_info" && onToolCall) {
                   onToolCall(call.name, args as Record<string, any>);
                   return { id: call.id, name: call.name, response: { status: "Background analysis requested successfully. Tell user they will receive a message." } };
                }
                return { id: call.id, name: call.name, response: { status: "Unknown tool" } };
              });
              
              // Use cached session directly instead of re-resolving the promise
              this.sendToolResponse(responses);
            }
          }
        },
        onerror: (error: any) => {
          console.error("Gemini Live session error:", error);
          this.isSessionActive = false;
          this.session = null;
        }
      }
    });

    // Worklet now posts base64 strings directly (encoding already done off main thread)
    this.workletNode.port.onmessage = (e) => {
      if (!this.isSessionActive || this.isIntentionalDisconnect || !this.session) return;

      const base64: string = e.data;

      // Backpressure check: skip frame if WebSocket buffer is congested
      try {
        const ws = (this.session as any)?.ws ?? (this.session as any)?._ws;
        if (ws && typeof ws.bufferedAmount === "number" && ws.bufferedAmount > WS_BACKPRESSURE_BYTES) {
          // Network congested — drop this frame to prevent memory buildup
          return;
        }
      } catch {
        // If we can't access the websocket, proceed anyway
      }

      try {
        this.session.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: "audio/pcm;rate=16000",
          }
        });
      } catch (err: any) {
        if (err.message && err.message.includes("CLOSING or CLOSED")) {
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
  private sendToolResponse(responses: any[]) {
    if (this.session) {
      try {
        this.session.send({ toolResponse: { functionResponses: responses } });
      } catch (e) {
        console.error("Error sending tool response", e);
      }
      return;
    }

    // Fallback: session may not be resolved yet (early tool call)
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        try {
          session.send({ toolResponse: { functionResponses: responses } });
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

    const chunks = this.playbackQueue.splice(0);

    try {
      // Decode all chunks into a combined PCM array
      let totalSamples = 0;
      const decodedChunks: Int16Array[] = [];

      for (const base64 of chunks) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
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
      source.connect(this.outAudioContext.destination);

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

  stop() {
    this.isIntentionalDisconnect = true;
    this.isSessionActive = false;
    this.session = null;

    this.stopPlaybackTimer();
    // Flush any remaining queued audio
    this.flushPlaybackQueue();
    this.playbackQueue = [];
    
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
      this.inAudioContext.close();
      this.inAudioContext = null;
    }
    if (this.outAudioContext) {
      this.outAudioContext.close();
      this.outAudioContext = null;
    }
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
         try {
             session.close();
         } catch(e) {}
      }).catch(() => {});
      this.sessionPromise = null;
    }
  }
}
