import {
  SequenceEventModel,
  SequenceEventType,
} from "../models/SequenceEvent";

// Funnel hodisasini yozadi. Analitika xatosi asosiy oqimga ta'sir qilmasligi kerak.
export async function recordSequenceEvent(params: {
  sourceTag: string;
  telegramId: number;
  type: SequenceEventType;
  order?: number;
}): Promise<void> {
  try {
    await SequenceEventModel.create({
      source_tag: params.sourceTag,
      telegram_id: params.telegramId,
      type: params.type,
      order: params.order,
      created_at: new Date(),
    });
  } catch {
    // e'tiborsiz — analitika bot ishiga xalaqit bermasin
  }
}

export interface FunnelStep {
  order: number;
  count: number;
}

export interface FunnelReport {
  sourceTag: string;
  started: number;
  steps: FunnelStep[];
  clicks: FunnelStep[];
}

// Bitta tag bo'yicha voronkani hisoblaydi: nechta odam boshladi va
// har bir xabar (order) nechta UNIKAL foydalanuvchiga muvaffaqiyatli yetdi.
export async function getFunnel(sourceTag: string): Promise<FunnelReport> {
  const startedAgg = await SequenceEventModel.aggregate([
    { $match: { source_tag: sourceTag } },
    { $group: { _id: null, users: { $addToSet: "$telegram_id" } } },
    { $project: { _id: 0, count: { $size: "$users" } } },
  ]);
  const started: number = startedAgg[0]?.count ?? 0;

  const deliveredAgg = await SequenceEventModel.aggregate([
    { $match: { source_tag: sourceTag, type: "delivered" } },
    { $group: { _id: "$order", users: { $addToSet: "$telegram_id" } } },
    { $project: { _id: 0, order: "$_id", count: { $size: "$users" } } },
    { $sort: { order: 1 } },
  ]);

  const steps: FunnelStep[] = deliveredAgg.map((s: { order?: number; count: number }) => ({
    order: s.order ?? 0,
    count: s.count,
  }));

  const clicksAgg = await SequenceEventModel.aggregate([
    { $match: { source_tag: sourceTag, type: "clicked" } },
    { $group: { _id: "$order", users: { $addToSet: "$telegram_id" } } },
    { $project: { _id: 0, order: "$_id", count: { $size: "$users" } } },
    { $sort: { order: 1 } },
  ]);
  const clicks: FunnelStep[] = clicksAgg.map((s: { order?: number; count: number }) => ({
    order: s.order ?? 0,
    count: s.count,
  }));

  return { sourceTag, started, steps, clicks };
}
