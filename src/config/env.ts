import dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

export const env = {
  botToken: process.env.BOT_TOKEN ?? "",
  mongoUri: process.env.MONGO_URI ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  queuePrefix: process.env.QUEUE_PREFIX ?? "",
  defaultWelcome: process.env.DEFAULT_WELCOME ?? "Welcome to the connector bot.",
  adminIds: (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? "info",
};

export function validateEnv(): void {
  if (!env.botToken) {
    throw new Error("BOT_TOKEN missing in environment.");
  }
  if (!env.mongoUri) {
    throw new Error("MONGO_URI missing in environment.");
  }
}
