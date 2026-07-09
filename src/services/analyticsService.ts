import {
  SequenceEventModel,
  SequenceEventType,
} from "../models/SequenceEvent";
import { getPackageWithMessages } from "./contentService";

// Funnel hodisasini yozadi. Analitika xatosi asosiy oqimga ta'sir qilmasligi kerak.
export async function recordSequenceEvent(params: {
  sourceTag: string;
  telegramId: number;
  type: SequenceEventType;
  order?: number;
  buttonIndex?: number;
}): Promise<void> {
  try {
    await SequenceEventModel.create({
      source_tag: params.sourceTag,
      telegram_id: params.telegramId,
      type: params.type,
      order: params.order,
      button_index: params.buttonIndex,
      created_at: new Date(),
    });
  } catch {
    // e'tiborsiz — analitika bot ishiga xalaqit bermasin
  }
}

export interface FunnelStep {
  order: number;
  delayMinutes: number;
  delivered: number; // yetgan (unikal)
  matured: number; // yetib ulgurishi mumkin bo'lganlar (kogort baza)
  waiting: number; // boshlagan, lekin hali vaqti kelmaganlar
  clicked: number; // tugma bosgan (unikal)
  reachPct: number; // delivered / matured — haqiqiy retention
  ctr: number; // clicked / delivered
}

export interface FunnelReport {
  sourceTag: string;
  started: number;
  steps: FunnelStep[];
}

// order bo'yicha unikal foydalanuvchilar sonini xaritaga yig'adi.
async function countByOrder(
  sourceTag: string,
  type: SequenceEventType
): Promise<Map<number, number>> {
  const agg = await SequenceEventModel.aggregate([
    { $match: { source_tag: sourceTag, type } },
    { $group: { _id: "$order", users: { $addToSet: "$telegram_id" } } },
    { $project: { _id: 0, order: "$_id", count: { $size: "$users" } } },
  ]);
  const map = new Map<number, number>();
  agg.forEach((r: { order?: number; count: number }) => map.set(r.order ?? 0, r.count));
  return map;
}

// Kogort voronka: har bir xabar uchun foizlar FAQAT yetib ulgurishi mumkin
// bo'lgan foydalanuvchilarga nisbatan hisoblanadi (kutayotganlar chiqariladi).
export async function getFunnel(sourceTag: string): Promise<FunnelReport> {
  const now = Date.now();
  const pkg = await getPackageWithMessages(sourceTag);
  const messages = pkg?.messages ?? [];

  // Har foydalanuvchining eng erta start vaqti (kogort uchun).
  const startsAgg = await SequenceEventModel.aggregate([
    { $match: { source_tag: sourceTag } },
    { $group: { _id: "$telegram_id", startAt: { $min: "$created_at" } } },
  ]);
  const startTimes = startsAgg.map((s: { startAt: Date }) =>
    new Date(s.startAt).getTime()
  );
  const started = startTimes.length;

  const deliveredMap = await countByOrder(sourceTag, "delivered");
  const clickedMap = await countByOrder(sourceTag, "clicked");

  const steps: FunnelStep[] = messages.map((m, i) => {
    const order = m.order ?? i;
    const delayMinutes = m.delay_minutes ?? 0;
    const thresholdMs = delayMinutes * 60 * 1000;
    const matured = startTimes.filter((t) => now - t >= thresholdMs).length;
    const delivered = deliveredMap.get(order) ?? 0;
    const clicked = clickedMap.get(order) ?? 0;
    const waiting = Math.max(0, started - matured);
    const reachPct = matured
      ? Math.min(100, Math.round((delivered / matured) * 100))
      : 0;
    const ctr = delivered ? Math.round((clicked / delivered) * 100) : 0;
    return { order, delayMinutes, delivered, matured, waiting, clicked, reachPct, ctr };
  });

  return { sourceTag, started, steps };
}
