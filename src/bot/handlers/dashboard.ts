import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { env } from "../../config/env";
import { enqueueTextMessage } from "../../services/messageQueueService";

// Admin uchun funnel dashboard'ini (Telegram Mini App) ochadigan tugma.
export async function handleDashboardCommand(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id ?? ctx.from?.id ?? 0;
  if (!env.webappUrl) {
    await enqueueTextMessage({
      chatId,
      text: "Dashboard hali sozlanmagan (WEBAPP_URL yo‘q).",
    });
    return;
  }
  await enqueueTextMessage({
    chatId,
    text: "📊 Analitika dashboard'ini oching:",
    replyMarkup: new InlineKeyboard().webApp(
      "📊 Dashboardni ochish",
      env.webappUrl
    ),
  });
}
