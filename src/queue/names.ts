import { env } from "../config/env";

export function resolveQueueName(baseName: string): string {
  const prefix = env.queuePrefix.trim();
  return prefix ? `${prefix}:${baseName}` : baseName;
}
