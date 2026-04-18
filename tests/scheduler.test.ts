import { afterEach, describe, expect, it } from "vitest";
import {
  listScheduledJobs,
  resetSchedulerForTests,
  runDueJobs,
  scheduleJob
} from "../packages/scheduler/src/index";

afterEach(() => {
  resetSchedulerForTests();
});

describe("scheduler", () => {
  it("queues and runs due jobs", () => {
    const now = Date.now();
    scheduleJob({
      sessionId: "s1",
      type: "bg_task",
      runAt: now - 1_000
    });

    const completed = runDueJobs(now);
    expect(completed).toHaveLength(1);
    expect(completed[0]?.status).toBe("done");
  });

  it("does not run future jobs", () => {
    const now = Date.now();
    scheduleJob({
      sessionId: "s1",
      type: "follow_up_checkin",
      runAt: now + 60_000
    });

    const completed = runDueJobs(now);
    expect(completed).toHaveLength(0);

    const queued = listScheduledJobs("s1");
    expect(queued[0]?.status).toBe("queued");
  });
});
