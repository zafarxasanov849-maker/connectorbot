import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env";
import { redisConfig } from "../config/redis";
import { MessageJobData } from "../types/message";
import { resolveQueueName } from "./names";

let queueInstance: Queue<MessageJobData> | null = null;

export function buildMessageQueue(): Queue<MessageJobData> {
  if (queueInstance) return queueInstance;
  const connection = new Redis(env.redisUrl, redisConfig);
  queueInstance = new Queue<MessageJobData>(resolveQueueName("message"), {
    connection,
  });
  return queueInstance;
}
