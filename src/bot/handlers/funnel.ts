import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { listContentTags, getPackageWithMessages } from "../../services/contentService";
import { getFunnel, FunnelReport } from "../../services/analyticsService";

const BAR_WIDTH = 10;

function bar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function renderFunnel(report: FunnelReport, messageCount: number): string {
  // Foizlar boshlaganlar soniga nisbatan hisoblanadi.
  const base = report.started || report.steps[0]?.count || 1;
  const lines = [
    `📊 "${report.sourceTag}" voronkasi`,
    `👥 Boshlaganlar: ${report.started} kishi`,
    "",
  ];

  const total = messageCount || report.steps.length;
  for (let i = 0; i < total; i++) {
    const step = report.steps.find((s) => s.order === i);
    const count = step?.count ?? 0;
    const pct = Math.round((count / base) * 100);
    lines.push(`#${i + 1}  ${bar(pct)}  ${count} (${pct}%)`);
  }

  if (total > 0) {
    const last = report.steps.find((s) => s.order === total - 1)?.count ?? 0;
    const conv = Math.round((last / base) * 100);
    lines.push("", `🎯 Yakuniy konversiya: ${conv}%`);
  }

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
  const pkg = await getPackageWithMessages(tag);
  const report = await getFunnel(tag);
  const text = renderFunnel(report, pkg?.messages?.length ?? report.steps.length);
  await ctx.editMessageText(text);
  return true;
}
