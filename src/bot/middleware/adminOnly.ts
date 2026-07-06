import { MiddlewareFn } from "grammy";
import { isAdmin } from "../../services/adminService";
import { enqueueTextMessage } from "../../services/messageQueueService";

export const adminOnly: MiddlewareFn = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? 0,
      text: "Foydalanuvchini aniqlab bo‘lmadi.",
    });
    return;
  }

  const allowed = await isAdmin(telegramId);
  if (!allowed) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? telegramId,
      text: "Sizda admin vakolatlari yo‘q.",
    });
    return;
  }

  return next();
};
