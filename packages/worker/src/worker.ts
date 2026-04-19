import { Worker } from "bullmq";
import { runBgAgent } from "@rhc/agents";
import { addUiMessage } from "@rhc/db";
import { logEvent } from "@rhc/obs";
import { patchSessionMemory } from "@rhc/rag";
import { applyAssistantGuardrails } from "@rhc/safety";
import { BG_ANALYSIS_QUEUE_NAME } from "./queue";

const worker = new Worker(
  BG_ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { sessionId, bgModel, bgMessages, userText, memoryBefore } = job.data;

    const bgResult = await runBgAgent({
      sessionId,
      model: bgModel,
      messages: bgMessages,
      query: userText,
      enableTools: true
    } as any) as any;

    let medicalReference: string | undefined;

    if (bgResult.drugHints.length > 0) {
      medicalReference = `For non-critical symptom support, FDA label references suggest these general-use medicine options: ${bgResult.drugHints.join(", ")}. Mention as options only and advise clinician confirmation.`;
    }

    if (bgResult.dosingInsights.length > 0) {
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

    patchSessionMemory(sessionId, {
      riskFlags: [...memoryBefore.riskFlags, ...(bgResult.shouldStop ? ["bg_loop_guard_stop"] : [])]
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
  },
  {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379)
    }
  }
);

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
  logEvent({
    category: "worker",
    action: "bg_analysis_failed",
    level: "error",
    sessionId: job?.data.sessionId,
    details: {
      error: err.message,
      jobId: job?.id
    }
  });
});
