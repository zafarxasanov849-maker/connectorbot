import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { env } from "../../config/env";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { forwardToAmoCrm, isAmoCrmConfigured } from "../../services/amoCrmService";
import { logger } from "../../utils/logger";

// Admin bo'lmagan oddiy foydalanuvchilarning xabarlari shu yerga keladi.
// Xabar AmoCRM'ga yuboriladi (agar sozlangan bo'lsa) va foydalanuvchiga
// admin bilan bog'lanish uchun havola beriladi.
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

  const contact = env.adminContact;
  if (contact) {
    await enqueueTextMessage({
      chatId,
      text:
        `Xabaringiz qabul qilindi ✅\n` +
        `Tezroq javob olish uchun admin bilan to‘g‘ridan-to‘g‘ri bog‘laning: @${contact}`,
      replyMarkup: new InlineKeyboard().url(
        "✍️ Admin bilan bog‘lanish",
        `https://t.me/${contact}`
      ),
    });
    return;
  }

  await enqueueTextMessage({
    chatId,
    text: "Xabaringiz qabul qilindi ✅\nTez orada siz bilan bog‘lanamiz.",
  });
}
