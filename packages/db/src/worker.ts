import { Worker } from "bullmq";
import { MESSAGE_QUEUE_NAME } from "./queue";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

const worker = new Worker(
  MESSAGE_QUEUE_NAME,
  async (job) => {
    const message = job.data;
    const client = await pool.connect();
    try {
      await client.query(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES ($1, $2, $3, $4)",
        [message.sessionId, message.role, message.content, message.createdAt]
      );
    } finally {
      client.release();
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379)
    }
  }
);

worker.on("failed", (job, err) => {
  console.error(`Message job ${job?.id} failed with error ${err.message}`);
});
