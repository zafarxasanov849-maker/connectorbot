import { validateEnv, env } from "./config/env";
import { connectDatabase } from "./config/database";
import { createBot } from "./bot/bot";
import { logger } from "./utils/logger";
import Redis from "ioredis";
import mongoose from "mongoose";
import { redisConfig } from "./config/redis";
import { Worker, Job } from "bullmq";
import { BroadcastJobData } from "./types/broadcast";
import { deliverContent } from "./services/deliveryService";
import { handleDeliveryError } from "./utils/deliveryError";
import { recordSequenceEvent } from "./services/analyticsService";
import { SequenceJobData } from "./types/sequence";
import { MessageJobData } from "./types/message";
import { Api, InputFile } from "grammy";
import { resolveQueueName } from "./queue/names";
import { startWebServer } from "./web/server";

async function bootstrap(): Promise<void> {
  validateEnv();
  await connectDatabase();

  const bot = createBot();
  bot.start().catch((err) => {
    logger.error("Bot xato bilan to'xtadi", err);
    process.exit(1);
  });
  logger.info("Bot started (all-in-one).");

  const workers = [
    startBroadcastWorker(),
    startSequenceWorker(),
    startMessageWorker(),
  ];
  logger.info("Workers started (broadcast, sequence, message).");

  // Funnel dashboard (Mini App) web-serveri.
  startWebServer();

  // Toza to'xtatish: SIGINT/SIGTERM'da bot, workerlar va ulanishlarni yopamiz.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} olindi — to'xtatilmoqda...`);
    try {
      await bot.stop();
      await Promise.all(workers.map((w) => w.close()));
      await mongoose.disconnect();
    } catch (err) {
      logger.error("To'xtatishda xato", err);
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

function startBroadcastWorker(): Worker<BroadcastJobData> {
  const api = new Api(env.botToken);
  const connection = new Redis(env.redisUrl, redisConfig);

  const processJob = async (job: Job<BroadcastJobData>): Promise<void> => {
    const { chatId, text, media, buttons } = job.data;
    try {
      await deliverContent({ api, chatId, text, media, buttons });
    } catch (error) {
      await handleDeliveryError(chatId, error);
    }
  };

  const worker = new Worker<BroadcastJobData>(resolveQueueName("broadcast"), processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 20, duration: 1000 },
  });

  worker.on("completed", (job) => logger.info(`Broadcast job ${job.id} completed.`));
  worker.on("failed", (job, err) => logger.error(`Broadcast job ${job?.id} failed`, err));
  return worker;
}

function startSequenceWorker(): Worker<SequenceJobData> {
  const api = new Api(env.botToken);
  const connection = new Redis(env.redisUrl, redisConfig);

  const processJob = async (job: Job<SequenceJobData>): Promise<void> => {
    const { chatId, text, media, buttons, sourceTag, order } = job.data;
    try {
      await deliverContent({ api, chatId, text, media, buttons });
      if (sourceTag) {
        await recordSequenceEvent({
          sourceTag,
          telegramId: chatId,
          type: "delivered",
          order,
        });
      }
    } catch (error) {
      await handleDeliveryError(chatId, error);
    }
  };

  const worker = new Worker<SequenceJobData>(resolveQueueName("sequence"), processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 20, duration: 1000 },
  });

  worker.on("completed", (job) => logger.info(`Sequence job ${job.id} completed`));
  worker.on("failed", (job, err) => logger.error(`Sequence job ${job?.id} failed`, err));
  return worker;
}

function startMessageWorker(): Worker<MessageJobData> {
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
  return worker;
}

bootstrap().catch((error) => {
  logger.error("Failed to start all-in-one runner", error);
  process.exit(1);
});
