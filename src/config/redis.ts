import { RedisOptions } from "ioredis";
import { env } from "./env";

export const redisConfig: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectionName: "connector-bot",
  port: Number(new URL(env.redisUrl).port) || 6379,
  host: new URL(env.redisUrl).hostname,
  password: new URL(env.redisUrl).password || undefined,
};
