import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "gen-lang-client-0648959586";

const MODELS_TO_TRY = [
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-2.5-flash-preview-native-audio-dialog",
  "gemini-2.5-flash-native-audio-dialog",
  "gemini-3-flash-live",
  "gemini-3.0-flash-live",
];

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testModel(modelId) {
  console.log(`\n--- Testing: ${modelId} ---`);
  try {
    const session = await ai.live.connect({
      model: modelId,
      config: {
        responseModalities: ["AUDIO"],
      },
      callbacks: {
        onopen: () => console.log(`  [${modelId}] OPENED`),
        onclose: (e) => console.log(`  [${modelId}] CLOSED`, e),
        onmessage: (msg) => console.log(`  [${modelId}] MSG:`, JSON.stringify(msg).slice(0, 200)),
        onerror: (err) => console.log(`  [${modelId}] ERROR:`, err?.message || err),
      },
    });

    // Wait a bit to see if it stays open
    await new Promise((r) => setTimeout(r, 3000));

    try { session.close(); } catch {}
    console.log(`  [${modelId}] ✅ Connection stayed open for 3s`);
  } catch (err) {
    console.log(`  [${modelId}] ❌ FAILED: ${err?.message || err}`);
  }
}

(async () => {
  for (const model of MODELS_TO_TRY) {
    await testModel(model);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\nDone. Exiting...");
  process.exit(0);
})();
