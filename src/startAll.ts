import { validateEnv, env } from "./config/env";
import { connectDatabase } from "./config/database";
import { createBot } from "./bot/bot";
import { logger } from "./utils/logger";
import Redis from "ioredis";
import { redisConfig } from "./config/redis";
import { Worker, Job } from "bullmq";
import { BroadcastJobData } from "./types/broadcast";
import { deliverContent } from "./services/deliveryService";
import { SequenceJobData } from "./types/sequence";
import { MessageJobData } from "./types/message";
import { Api, InputFile } from "grammy";
import { resolveQueueName } from "./queue/names";

async function bootstrap(): Promise<void> {
  validateEnv();
  await connectDatabase();

  // Start bot without blocking the rest of the services.
  const bot = createBot();
  bot.start().catch((err) => {
    logger.error("Bot stopped with error", err);
    process.exit(1);
  });
  logger.info("Bot started (all-in-one).");

  startBroadcastWorker();
  startSequenceWorker();
  startMessageWorker();
  logger.info("Workers started (broadcast, sequence, message).");
}

function startBroadcastWorker(): void {
  const api = new Api(env.botToken);
  const connection = new Redis(env.redisUrl, redisConfig);

  const processJob = async (job: Job<BroadcastJobData>): Promise<void> => {
    const { chatIds, text, media, buttons } = job.data;
    for (const chatId of chatIds) {
      try {
        await deliverContent({ api, chatId, text, media, buttons });
      } catch (error) {
        logger.error(`Failed to deliver to ${chatId}`, error);
      }
    }
  };

  const worker = new Worker<BroadcastJobData>(resolveQueueName("broadcast"), processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 20, duration: 1000 },
  });

  worker.on("completed", (job) => logger.info(`Broadcast job ${job.id} completed.`));
  worker.on("failed", (job, err) => logger.error(`Broadcast job ${job?.id} failed`, err));
}

function startSequenceWorker(): void {
  const api = new Api(env.botToken);
  const connection = new Redis(env.redisUrl, redisConfig);

  const processJob = async (job: Job<SequenceJobData>): Promise<void> => {
    const { chatId, text, media, buttons } = job.data;
    try {
      await deliverContent({ api, chatId, text, media, buttons });
    } catch (error) {
      logger.error(`Failed to send sequence message to ${chatId}`, error);
    }
  };

  const worker = new Worker<SequenceJobData>(resolveQueueName("sequence"), processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 20, duration: 1000 },
  });

  worker.on("completed", (job) => logger.info(`Sequence job ${job.id} completed`));
  worker.on("failed", (job, err) => logger.error(`Sequence job ${job?.id} failed`, err));
}

function startMessageWorker(): void {
  const api = new Api(env.botToken);
  const connection = new Redis(env.redisUrl, redisConfig);

  const processJob = async (job: Job<MessageJobData>): Promise<void> => {
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
  };

  const worker = new Worker<MessageJobData>(resolveQueueName("message"), processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 20, duration: 1000 },
  });

  worker.on("completed", (job) => logger.info(`Message job ${job.id} completed`));
  worker.on("failed", (job, err) => logger.error(`Message job ${job?.id} failed`, err));
}

bootstrap().catch((error) => {
  logger.error("Failed to start all-in-one runner", error);
  process.exit(1);
});
