import { Queue } from "bullmq";
import { BroadcastJobData } from "../types/broadcast";
import { UserModel } from "../models/User";
import { buildBroadcastQueue } from "../queue/broadcastQueue";

export type BroadcastTarget =
  | { type: "all" }
  | { type: "source"; source_tag: string };

export async function countRecipients(target: BroadcastTarget): Promise<number> {
  if (target.type === "source") {
    return UserModel.countDocuments({ source_tag: target.source_tag });
  }
  return UserModel.countDocuments({});
}

export async function queueBroadcast(
  queue: Queue<BroadcastJobData>,
  payload: BroadcastJobData
): Promise<void> {
  await queue.add("broadcast", payload, {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}

export async function resolveRecipients(target: BroadcastTarget): Promise<number[]> {
  if (target.type === "source") {
    const users = await UserModel.find(
      { source_tag: target.source_tag },
      { telegram_id: 1 }
    ).lean();
    return users.map((u) => u.telegram_id);
  }

  const allUsers = await UserModel.find({}, { telegram_id: 1 }).lean();
  return allUsers.map((u) => u.telegram_id);
}

export function getQueue(): Queue<BroadcastJobData> {
  return buildBroadcastQueue();
}
