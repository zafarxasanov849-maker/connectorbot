import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { listContentTags } from "../../services/contentService";
import { getTrend, TrendReport } from "../../services/analyticsService";

const BAR_WIDTH = 10;

function bar(value: number, max: number): string {
  const filled = max > 0 ? Math.round((value / max) * BAR_WIDTH) : 0;
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function renderTrend(report: TrendReport): string {
  const max = Math.max(1, ...report.days.map((d) => d.started));
  const totalStarted = report.days.reduce((s, d) => s + d.started, 0);
  const totalClicked = report.days.reduce((s, d) => s + d.clicked, 0);

  const lines = [
    `📈 "${report.sourceTag}" trendi (${report.days.length} kun)`,
    `Yangi foydalanuvchilar: ${totalStarted} · kliklar: ${totalClicked}`,
    "",
  ];

  report.days.forEach((d) => {
    const label = d.date.slice(5); // MM-DD
    const clickTag = d.clicked > 0 ? ` (👆${d.clicked})` : "";
    lines.push(`${label}  ${bar(d.started, max)} ${d.started}${clickTag}`);
  });

  return lines.join("\n");
}

export async function handleTrendCommand(ctx: BotContext): Promise<void> {
  const tags = await listContentTags();
  if (!tags.length) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Hali hech qanday tag uchun kontent yo‘q.",
    });
    return;
  }
  const kb = new InlineKeyboard();
  tags.forEach((tag) => kb.text(tag, `trend_tag:${tag}`).row());
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: "Qaysi tag trendini ko‘rasiz?",
    replyMarkup: kb,
  });
}

export async function handleTrendCallback(ctx: BotContext): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("trend_tag:")) return false;

  const tag = data.slice("trend_tag:".length);
  const report = await getTrend(tag);
  await ctx.editMessageText(renderTrend(report));
  return true;
}
