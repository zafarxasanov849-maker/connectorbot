import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { Api, InputFile } from "grammy";
import { env, validateEnv } from "../config/env";
import { redisConfig } from "../config/redis";
import { MessageJobData } from "../types/message";
import { logger } from "../utils/logger";
import { resolveQueueName } from "../queue/names";

validateEnv();

const api = new Api(env.botToken);
const connection = new Redis(env.redisUrl, redisConfig);

async function processJob(job: Job<MessageJobData>): Promise<void> {
  const data = job.data;
  if (data.kind === "text") {
    await api.sendMessage(data.chatId, data.text, {
      parse_mode: data.parseMode,
      reply_markup: data.replyMarkup,
    });
    return;
  }

  if (data.kind === "document") {
    const buffer = Buffer.from(data.data, "base64");
    await api.sendDocument(data.chatId, new InputFile(buffer, data.filename), {
      caption: data.caption,
      reply_markup: data.replyMarkup,
    });
  }
}

const worker = new Worker<MessageJobData>(resolveQueueName("message"), processJob, {
  connection,
  concurrency: 1,
  limiter: { max: 20, duration: 1000 },
});

worker.on("completed", (job) => {
  logger.info(`Message job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`Message job ${job?.id} failed`, err);
});

logger.info("Message worker running...");
