import {
  SequenceEventModel,
  SequenceEventType,
} from "../models/SequenceEvent";
import { getPackageWithMessages, listContentTags } from "./contentService";

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

export interface TrendDay {
  date: string; // YYYY-MM-DD
  started: number;
  clicked: number;
}

export interface TrendReport {
  sourceTag: string;
  days: TrendDay[];
}

// Kunlik trend: oxirgi N kunda har kuni nechta yangi foydalanuvchi va klik.
// sourceTag berilmasa — barcha taglar bo'yicha umumiy.
export async function getTrend(
  sourceTag?: string,
  days = 14
): Promise<TrendReport> {
  const dayMs = 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - (days - 1) * dayMs);
  since.setUTCHours(0, 0, 0, 0);

  const match: Record<string, unknown> = { created_at: { $gte: since } };
  if (sourceTag) match.source_tag = sourceTag;

  const agg = await SequenceEventModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          type: "$type",
        },
        users: { $addToSet: "$telegram_id" },
      },
    },
    { $project: { _id: 0, day: "$_id.day", type: "$_id.type", count: { $size: "$users" } } },
  ]);

  const map = new Map<string, { started: number; clicked: number }>();
  agg.forEach((r: { day: string; type: string; count: number }) => {
    const e = map.get(r.day) ?? { started: 0, clicked: 0 };
    if (r.type === "started") e.started = r.count;
    else if (r.type === "clicked") e.clicked = r.count;
    map.set(r.day, e);
  });

  const out: TrendDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * dayMs).toISOString().slice(0, 10);
    const e = map.get(key) ?? { started: 0, clicked: 0 };
    out.push({ date: key, started: e.started, clicked: e.clicked });
  }
  return { sourceTag: sourceTag ?? "*", days: out };
}

export interface OverviewRow {
  tag: string;
  started: number;
  clicks: number;
  conversion: number;
}

export interface OverviewReport {
  totalUsers: number;
  totalClicks: number;
  tagCount: number;
  rows: OverviewRow[];
  trend: TrendDay[];
}

// Barcha taglar bo'yicha umumiy ko'rinish: KPI'lar, jadval va 30 kunlik trend.
export async function getOverview(): Promise<OverviewReport> {
  const tags = await listContentTags();

  const rows = await Promise.all(
    tags.map(async (tag) => {
      const f = await getFunnel(tag);
      const clicks = f.steps.reduce((s, st) => s + st.clicked, 0);
      const conversion = f.steps.length
        ? f.steps[f.steps.length - 1].reachPct
        : 0;
      return { tag, started: f.started, clicks, conversion };
    })
  );
  rows.sort((a, b) => b.started - a.started);

  const totalUsersAgg = await SequenceEventModel.aggregate([
    { $group: { _id: null, users: { $addToSet: "$telegram_id" } } },
    { $project: { _id: 0, count: { $size: "$users" } } },
  ]);
  const totalUsers = totalUsersAgg[0]?.count ?? 0;
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const trend = (await getTrend(undefined, 30)).days;

  return { totalUsers, totalClicks, tagCount: tags.length, rows, trend };
}
