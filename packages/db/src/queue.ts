import { Queue } from "bullmq";

export const MESSAGE_QUEUE_NAME = "message";

export const messageQueue = new Queue(MESSAGE_QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379)
  }
});
