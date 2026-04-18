import { getOpenRouterClient } from "@rhc/ai/openrouter-client";
export async function transcribeAudio(base64Audio, format = "wav") {
    const openrouter = getOpenRouterClient();
    const completion = await openrouter.chat.completions.create({
        model: process.env.AUDIO_TRANSCRIBE_MODEL || "openai/gpt-4o-audio-preview",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Transcribe this audio verbatim. Preserve original language." },
                    { type: "input_audio", input_audio: { data: base64Audio, format } }
                ]
            }
        ]
    });
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === "string")
        return raw;
    if (Array.isArray(raw)) {
        return raw
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join(" ")
            .trim();
    }
    return "";
}
