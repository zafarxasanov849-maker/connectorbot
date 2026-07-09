import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { Api } from "grammy";
import { env, validateEnv } from "../config/env";
import { redisConfig } from "../config/redis";
import { SequenceJobData } from "../types/sequence";
import { deliverContent } from "../services/deliveryService";
import { handleDeliveryError } from "../utils/deliveryError";
import { logger } from "../utils/logger";
import { resolveQueueName } from "../queue/names";

validateEnv();

const api = new Api(env.botToken);
const connection = new Redis(env.redisUrl, redisConfig);

async function processJob(job: Job<SequenceJobData>): Promise<void> {
  const { chatId, text, media, buttons } = job.data;
  try {
    await deliverContent({ api, chatId, text, media, buttons });
  } catch (error) {
    await handleDeliveryError(chatId, error);
  }
}

const worker = new Worker<SequenceJobData>(resolveQueueName("sequence"), processJob, {
  connection,
  concurrency: 1,
  limiter: { max: 20, duration: 1000 },
});

worker.on("completed", (job) => {
  logger.info(`Sequence job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Sequence job ${job?.id} failed`, err);
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} olindi — sequence worker to'xtatilmoqda...`);
  await worker.close();
  await connection.quit();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

logger.info("Sequence worker running...");
