import { validateEnv } from "./config/env";
import { connectDatabase } from "./config/database";
import { createBot } from "./bot/bot";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
  try {
    validateEnv();
    await connectDatabase();
    const bot = createBot();
    await bot.start();
    logger.info("Bot started successfully.");
  } catch (error) {
    logger.error("Failed to start bot", error);
    process.exit(1);
  }
}

bootstrap();
