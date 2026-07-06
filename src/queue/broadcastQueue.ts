import { Queue } from "bullmq";
import Redis from "ioredis";
import { BroadcastJobData } from "../types/broadcast";
import { env } from "../config/env";
import { redisConfig } from "../config/redis";
import { resolveQueueName } from "./names";

let queueInstance: Queue<BroadcastJobData> | null = null;

export function buildBroadcastQueue(): Queue<BroadcastJobData> {
  if (queueInstance) return queueInstance;

  const connection = new Redis(env.redisUrl, redisConfig);
  queueInstance = new Queue<BroadcastJobData>(resolveQueueName("broadcast"), {
    connection,
  });
  return queueInstance;
}
