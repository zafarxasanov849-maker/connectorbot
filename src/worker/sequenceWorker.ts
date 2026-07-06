import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { Api } from "grammy";
import { env, validateEnv } from "../config/env";
import { redisConfig } from "../config/redis";
import { SequenceJobData } from "../types/sequence";
import { deliverContent } from "../services/deliveryService";
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
    logger.error(`Failed to send sequence message to ${chatId}`, error);
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

logger.info("Sequence worker running...");
