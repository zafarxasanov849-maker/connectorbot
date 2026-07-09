import mongoose from "mongoose";
import { validateEnv } from "./config/env";
import { connectDatabase } from "./config/database";
import { createBot } from "./bot/bot";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
  try {
    validateEnv();
    await connectDatabase();
    const bot = createBot();

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} olindi — bot to'xtatilmoqda...`);
      try {
        await bot.stop();
        await mongoose.disconnect();
      } finally {
        process.exit(0);
      }
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

    await bot.start();
    logger.info("Bot started successfully.");
  } catch (error) {
    logger.error("Failed to start bot", error);
    process.exit(1);
  }
}

bootstrap();
