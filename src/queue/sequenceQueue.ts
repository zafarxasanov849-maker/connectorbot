import { Queue } from "bullmq";
import Redis from "ioredis";
import { SequenceJobData } from "../types/sequence";
import { env } from "../config/env";
import { redisConfig } from "../config/redis";
import { resolveQueueName } from "./names";

let queueInstance: Queue<SequenceJobData> | null = null;

export function buildSequenceQueue(): Queue<SequenceJobData> {
  if (queueInstance) return queueInstance;
  const connection = new Redis(env.redisUrl, redisConfig);
  queueInstance = new Queue<SequenceJobData>(resolveQueueName("sequence"), {
    connection,
  });
  return queueInstance;
}
