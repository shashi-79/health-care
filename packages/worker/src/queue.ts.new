import { Queue, QueueEvents } from "bullmq";

export const BG_ANALYSIS_QUEUE_NAME = "bg-analysis";

type ConnectionConfig = {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
  enableOfflineQueue: boolean;
  connectTimeout: number;
  lazyConnect: boolean;
  retryStrategy: (times: number) => number | null;
};

function buildConnection(): ConnectionConfig {
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 1_500,
    lazyConnect: true,
    // After 3 retries give up so we fall back to inline execution.
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1_000))
  };
}

let cachedQueue: Queue | null = null;
let queueDisabledReason: string | null = null;

function resolveQueue(): Queue | null {
  if (queueDisabledReason) return null;
  if (cachedQueue) return cachedQueue;
  if (process.env.DISABLE_BG_QUEUE === "1") {
    queueDisabledReason = "disabled_via_env";
    return null;
  }
  try {
    cachedQueue = new Queue(BG_ANALYSIS_QUEUE_NAME, {
      connection: buildConnection()
    });

    // Swallow connection errors so Next.js route handlers don't crash.
    cachedQueue.on("error", (error) => {
      if (process.env.DEBUG_BG_QUEUE === "1") {
        console.warn("[bg-analysis queue] error:", (error as Error)?.message ?? error);
      }
    });

    return cachedQueue;
  } catch (error) {
    queueDisabledReason = `init_failed:${(error as Error)?.message ?? String(error)}`;
    return null;
  }
}

export const bgAnalysisQueue: Queue | null = (() => {
  try {
    return resolveQueue();
  } catch {
    return null;
  }
})();

export type BgAnalysisJobData = {
  sessionId: string;
  bgModel: string;
  bgMessages: Array<{ role: string; content: string }>;
  userText: string;
  memoryBefore: unknown;
};

export type EnqueueResult =
  | { queued: true; jobId: string | undefined }
  | { queued: false; reason: string };

/**
 * Attempt to enqueue a background analysis job. Never throws — returns a
 * result object so the caller can decide how to degrade (e.g. run inline).
 */
export async function enqueueBgAnalysis(data: BgAnalysisJobData): Promise<EnqueueResult> {
  const queue = resolveQueue();
  if (!queue) {
    return { queued: false, reason: queueDisabledReason ?? "queue_unavailable" };
  }
  try {
    const job = await Promise.race([
      queue.add("bg-analysis", data, {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("enqueue_timeout")), 2_000)
      )
    ]);
    return { queued: true, jobId: (job as { id?: string }).id };
  } catch (error) {
    const reason = (error as Error)?.message ?? String(error);
    if (reason.includes("ECONNREFUSED") || reason.includes("enqueue_timeout")) {
      queueDisabledReason = `redis_unreachable:${reason}`;
    }
    return { queued: false, reason };
  }
}

export function getQueueEvents() {
  if (!resolveQueue()) return null;
  try {
    return new QueueEvents(BG_ANALYSIS_QUEUE_NAME, { connection: buildConnection() });
  } catch {
    return null;
  }
}

export function isBgQueueAvailable(): boolean {
  return resolveQueue() !== null;
}
