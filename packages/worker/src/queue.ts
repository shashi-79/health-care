import { Queue } from "bullmq";

export const BG_ANALYSIS_QUEUE_NAME = "bg-analysis";

export const bgAnalysisQueue = new Queue(BG_ANALYSIS_QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
    enableOfflineQueue: true
  }
});

// Handle errors stealthily to avoid crashing the server if Redis is down
bgAnalysisQueue.on("error", (err) => {
  console.error("Queue error (Redis unavailable?):", err.message);
});

export async function enqueueBgAnalysis(jobData: any): Promise<{ queued: boolean; reason?: string }> {
  try {
    // Attempt ping or throw soon if disconnected. Let's just rely on add with a timeout if it fails
    await bgAnalysisQueue.add("bg-analysis", jobData, { removeOnComplete: true, removeOnFail: true });
    return { queued: true };
  } catch (err: any) {
    return { queued: false, reason: err.message };
  }
}
