import { GrammyError } from "grammy";
import { logger } from "./logger";
import { deactivateUser } from "../services/userService";

// Xabar yetkazishda chiqqan xatoni qayta ishlaydi.
// 403 (bot bloklandi) bo'lsa — foydalanuvchini nofaol qilamiz, shunda
// keyingi broadcast'larda unga qayta urinilmaydi.
export async function handleDeliveryError(
  chatId: number,
  error: unknown
): Promise<void> {
  if (error instanceof GrammyError && error.error_code === 403) {
    logger.warn(`Bot bloklandi (403), nofaol qilinmoqda: ${chatId}`);
    await deactivateUser(chatId).catch((e) =>
      logger.error("deactivateUser xatosi", e)
    );
    return;
  }
  logger.error(`Yetkazishda xato: ${chatId}`, error);
}
