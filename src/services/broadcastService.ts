import { Queue } from "bullmq";
import { BroadcastJobData } from "../types/broadcast";
import { UserModel } from "../models/User";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { buildBroadcastQueue } from "../queue/broadcastQueue";

export type BroadcastTarget =
  | { type: "all" }
  | { type: "source"; source_tag: string };

// Faqat aktiv (botni bloklamagan) foydalanuvchilar hisobga olinadi.
function targetFilter(target: BroadcastTarget): Record<string, unknown> {
  return target.type === "source"
    ? { source_tag: target.source_tag, is_active: true }
    : { is_active: true };
}

export async function countRecipients(target: BroadcastTarget): Promise<number> {
  return UserModel.countDocuments(targetFilter(target));
}

// Har bir foydalanuvchi uchun alohida job qo'shamiz — shunda BullMQ limiteri
// (20 msg/sek) haqiqatan ishlaydi va bitta job xato bo'lsa faqat o'sha qayta yuboriladi.
export async function queueBroadcast(
  queue: Queue<BroadcastJobData>,
  chatIds: number[],
  content: { text?: string; media?: IMediaFile[]; buttons?: IContentButton[] }
): Promise<void> {
  const jobs = chatIds.map((chatId) => ({
    name: "broadcast",
    data: { chatId, ...content },
    opts: {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 2000 },
    },
  }));
  await queue.addBulk(jobs);
}

export async function resolveRecipients(target: BroadcastTarget): Promise<number[]> {
  const users = await UserModel.find(
    targetFilter(target),
    { telegram_id: 1 }
  ).lean();
  return users.map((u) => u.telegram_id);
}

export function getQueue(): Queue<BroadcastJobData> {
  return buildBroadcastQueue();
}
