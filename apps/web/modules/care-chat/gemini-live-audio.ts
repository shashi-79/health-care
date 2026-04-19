import { GoogleGenAI, Modality } from "@google/genai";

export class GeminiLiveAudio {
  private ai: GoogleGenAI;
  private model: string;
  private sessionPromise: Promise<any> | null = null;
  private inAudioContext: AudioContext | null = null;
  private outAudioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private nextPlayTime: number = 0;
  private isSessionActive: boolean = false;
  private isIntentionalDisconnect: boolean = false;

  constructor(apiKey: string, model?: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model || "gemini-2.5-flash-native-audio-preview-12-2025";
  }

  async startStream(
    stream: MediaStream,
    onServerResponse?: (text: string) => void
  ) {
    this.isIntentionalDisconnect = false;
    this.inAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    this.outAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    this.nextPlayTime = 0;

    if (this.inAudioContext.state === 'suspended') {
      await this.inAudioContext.resume();
    }

    this.sourceNode = this.inAudioContext.createMediaStreamSource(stream);
    this.processorNode = this.inAudioContext.createScriptProcessor(4096, 1, 1);

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.inAudioContext.destination);

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
          parts: [{ text: "You are a helpful rural healthcare assistant. Respond naturally in conversation. Keep responses concise and caring." }]
        }
      } as any,
      callbacks: {
        onopen: () => {
           console.log("Live API opened");
           this.isSessionActive = true;
        },
        onclose: (e: any) => {
          console.log("Gemini Live session closed", e?.reason || "");
          this.isSessionActive = false;
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
                this.playAudioChunk(part.inlineData.data);
              }
              if (part.text && onServerResponse) {
                onServerResponse(part.text);
              }
            }
          }
        },
        onerror: (error: any) => {
          console.error("Gemini Live session error:", error);
          this.isSessionActive = false;
        }
      }
    });

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isSessionActive || this.isIntentionalDisconnect || !this.sessionPromise) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);

      this.sessionPromise.then((session) => {
        if (!this.isSessionActive || this.isIntentionalDisconnect) return;
        try {
          session.sendRealtimeInput({
            audio: {
              data: base64,
              mimeType: "audio/pcm;rate=16000",
            }
          });
        } catch (err: any) {
          if (err.message && err.message.includes("CLOSING or CLOSED")) {
            this.isSessionActive = false;
            console.warn("WebSocket closed, stopping audio");
          } else {
            console.error("Error sending realtime input:", err);
          }
        }
      }).catch(() => {});
    };

    try {
        const session = await this.sessionPromise;
        if (this.isIntentionalDisconnect) {
            session.close();
            return;
        }
    } catch (error) {
        console.error("Error connecting to Live API", error);
    }
  }

  private playAudioChunk(base64: string) {
    if (!this.outAudioContext) return;

    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = this.outAudioContext.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768;
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
      console.error("Error playing audio chunk", err);
    }
  }

  stop() {
    this.isIntentionalDisconnect = true;
    this.isSessionActive = false;
    
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
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
