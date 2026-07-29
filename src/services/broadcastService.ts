import { Queue } from "bullmq";
import { Api } from "grammy";
import { BroadcastJobData } from "../types/broadcast";
import { UserModel } from "../models/User";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { BroadcastModel, IBroadcast } from "../models/Broadcast";
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
  content: { text?: string; media?: IMediaFile[]; buttons?: IContentButton[] },
  broadcastId?: string
): Promise<void> {
  const jobs = chatIds.map((chatId) => ({
    name: "broadcast",
    data: { chatId, broadcastId, ...content },
    opts: {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 2000 },
    },
  }));
  await queue.addBulk(jobs);
}

// --- Reklama hisoboti ---

export async function createBroadcast(params: {
  adminId: number;
  target: string;
  textPreview: string;
  buttons: { label: string; url: string }[];
  total: number;
}): Promise<string> {
  const doc = await BroadcastModel.create({
    admin_id: params.adminId,
    target: params.target,
    text_preview: params.textPreview,
    buttons: params.buttons,
    total: params.total,
  });
  return String(doc._id);
}

export async function markBroadcastResult(
  broadcastId: string,
  ok: boolean
): Promise<IBroadcast | null> {
  return BroadcastModel.findOneAndUpdate(
    { _id: broadcastId },
    { $inc: ok ? { delivered: 1 } : { failed: 1 } },
    { new: true }
  ).lean();
}

// Reklama tugagan bo'lsa (delivered+failed === total), adminga bir marta
// yakuniy hisobot yuboradi.
export async function maybeSendBroadcastReport(
  api: Api,
  doc: IBroadcast | null
): Promise<void> {
  if (!doc || doc.reported) return;
  if (doc.delivered + doc.failed < doc.total) return;

  // Atomik: faqat bir marta "reported" belgilaymiz (dublikat hisobot bo'lmasin).
  const claimed = await BroadcastModel.findOneAndUpdate(
    { _id: doc._id, reported: { $ne: true } },
    { $set: { reported: true } },
    { new: true }
  ).lean();
  if (!claimed) return;

  const clicks = claimed.clickers?.length ?? 0;
  const target =
    claimed.target === "all" ? "Hammasi" : claimed.target.replace("source:", "");
  const text =
    `📣 Reklama yakunlandi — ${target}\n\n` +
    `✅ Yetkazildi: ${claimed.delivered}/${claimed.total}\n` +
    `❌ Yetmadi: ${claimed.failed}\n` +
    `👆 Bosilgan: ${clicks}\n\n` +
    `Kliklar vaqt o'tishi bilan ko'payadi — /broadcasts da kuzatib boring.`;
  await api.sendMessage(claimed.admin_id, text).catch(() => {});
}

export async function addBroadcastClicker(
  broadcastId: string,
  telegramId: number
): Promise<void> {
  await BroadcastModel.updateOne(
    { _id: broadcastId },
    { $addToSet: { clickers: telegramId } }
  );
}

export async function getBroadcastButtonUrl(
  broadcastId: string,
  index: number
): Promise<string | null> {
  const b = await BroadcastModel.findById(broadcastId).lean();
  return b?.buttons?.[index]?.url ?? null;
}

export async function getRecentBroadcasts(limit = 10): Promise<IBroadcast[]> {
  return BroadcastModel.find().sort({ created_at: -1 }).limit(limit).lean();
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
