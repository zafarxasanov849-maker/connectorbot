import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { forwardToAmoCrm, isAmoCrmConfigured } from "../../services/amoCrmService";
import { logger } from "../../utils/logger";

// Admin bo'lmagan oddiy foydalanuvchilarning xabarlari shu yerga keladi.
// Xabar AmoCRM'ga yuboriladi (agar sozlangan bo'lsa) va foydalanuvchiga
// qabul qilingani haqida javob beriladi.
export async function userMessageHandler(ctx: BotContext): Promise<void> {
  // Buyruqlarni e'tiborsiz qoldiramiz (/start alohida ishlangan).
  if (ctx.message?.text?.startsWith("/")) return;

  const chatId = ctx.chat?.id ?? ctx.from?.id ?? 0;
  const text =
    (ctx.message && "text" in ctx.message ? ctx.message.text : undefined) ??
    ctx.message?.caption;

  if (isAmoCrmConfigured() && text) {
    try {
      await forwardToAmoCrm({
        telegramId: ctx.from?.id ?? chatId,
        username: ctx.from?.username ?? undefined,
        text,
      });
    } catch (error) {
      // AmoCRM xatosi foydalanuvchiga ta'sir qilmasligi kerak.
      logger.error("AmoCRM'ga yuborishda xato", error);
    }
  }

  await enqueueTextMessage({
    chatId,
    text: "Xabaringiz qabul qilindi ✅\nTez orada siz bilan bog‘lanamiz.",
  });
}
