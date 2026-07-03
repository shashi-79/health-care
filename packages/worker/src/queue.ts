import { runBgAgent } from "@rhc/agents";
import { addUiMessage } from "@rhc/db";
import { logEvent } from "@rhc/obs";
import { patchSessionMemory } from "@rhc/rag";
import { applyAssistantGuardrails } from "@rhc/safety";

export type BgAnalysisJobData = {
  sessionId: string;
  bgModel: string;
  bgMessages: Array<{ role: string; content: string }>;
  userText: string;
  memoryBefore: any;
};

export type EnqueueResult =
  | { queued: true; jobId: string | undefined }
  | { queued: false; reason: string };

export async function enqueueBgAnalysis(data: BgAnalysisJobData): Promise<EnqueueResult> {
  const { sessionId, bgModel, bgMessages, userText, memoryBefore } = data;

  // Execute in the background asynchronously using setTimeout to not block the request thread.
  setTimeout(async () => {
    try {
      logEvent({
        category: "worker",
        action: "bg_analysis_started",
        level: "info",
        sessionId,
        details: { bgModel, userText }
      });

      const bgResult = (await runBgAgent({
        sessionId,
        model: bgModel,
        messages: bgMessages,
        query: userText,
        enableTools: true
      } as any)) as any;

      let medicalReference: string | undefined;
      if (bgResult.drugHints && bgResult.drugHints.length > 0) {
        medicalReference = `For non-critical symptom support, FDA label references suggest these general-use medicine options: ${bgResult.drugHints.join(", ")}. Mention as options only and advise clinician confirmation.`;
      }

      if (bgResult.dosingInsights && bgResult.dosingInsights.length > 0) {
        const conciseDosing = bgResult.dosingInsights.slice(0, 2).join(" | ");
        medicalReference = `${medicalReference ?? ""} BG dosing review: ${conciseDosing}`.trim();
      }

      const assistantText = medicalReference ?? "Background analysis complete. What are your current symptoms?";
      const safetyReview = applyAssistantGuardrails(assistantText);

      addUiMessage({
        sessionId,
        role: "assistant",
        content: safetyReview.text
      });

      const existingFlags = (memoryBefore && typeof memoryBefore === "object" && "riskFlags" in memoryBefore && Array.isArray(memoryBefore.riskFlags))
        ? memoryBefore.riskFlags
        : [];

      await patchSessionMemory(sessionId, {
        riskFlags: [...existingFlags, ...(bgResult.shouldStop ? ["bg_loop_guard_stop"] : [])]
      });

      logEvent({
        category: "worker",
        action: "bg_analysis_complete",
        level: "info",
        sessionId,
        details: {
          ...bgResult
        }
      });
    } catch (err: any) {
      console.error(`Background analysis job failed: ${err.message}`);
      logEvent({
        category: "worker",
        action: "bg_analysis_failed",
        level: "error",
        sessionId,
        details: {
          error: err.message
        }
      });
    }
  }, 10);

  return { queued: true, jobId: "inprocess-" + Date.now() };
}

export function getQueueEvents() {
  return null;
}

export function isBgQueueAvailable(): boolean {
  return true;
}

export const bgAnalysisQueue = null;
export const BG_ANALYSIS_QUEUE_NAME = "bg-analysis";
