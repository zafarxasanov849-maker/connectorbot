import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { listContentTags } from "../../services/contentService";
import { getFunnel, FunnelReport } from "../../services/analyticsService";

const BAR_WIDTH = 10;

function bar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

// Kogort voronka: foizlar "yetib ulgurishi mumkin bo'lganlar"ga nisbatan.
function renderFunnel(report: FunnelReport): string {
  const lines = [
    `📊 "${report.sourceTag}" voronkasi`,
    `👥 Boshlaganlar: ${report.started} kishi`,
    "",
  ];

  if (!report.steps.length) {
    lines.push("Bu tag uchun hali xabar yo‘q.");
    return lines.join("\n");
  }

  report.steps.forEach((s, i) => {
    lines.push(`#${i + 1}  ${bar(s.reachPct)}  ${s.delivered}/${s.matured} (${s.reachPct}%)`);
    const extra: string[] = [];
    if (s.waiting > 0) extra.push(`⏳ kutmoqda: ${s.waiting}`);
    if (s.clicked > 0) extra.push(`👆 bosgan: ${s.clicked} (CTR ${s.ctr}%)`);
    if (extra.length) lines.push(`     ${extra.join("   ")}`);
  });

  const last = report.steps[report.steps.length - 1];
  lines.push("", `🎯 Yakuniy konversiya: ${last.reachPct}%`);
  return lines.join("\n");
}

export async function handleFunnelCommand(ctx: BotContext): Promise<void> {
  const tags = await listContentTags();
  if (!tags.length) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Hali hech qanday tag uchun kontent yo‘q.",
    });
    return;
  }
  const kb = new InlineKeyboard();
  tags.forEach((tag) => kb.text(tag, `funnel_tag:${tag}`).row());
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: "Qaysi tag voronkasini ko‘rasiz?",
    replyMarkup: kb,
  });
}

export async function handleFunnelCallback(ctx: BotContext): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("funnel_tag:")) return false;

  const tag = data.slice("funnel_tag:".length);
  const report = await getFunnel(tag);
  await ctx.editMessageText(renderFunnel(report));
  return true;
}
