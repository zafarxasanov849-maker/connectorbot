import { Api, InlineKeyboard } from "grammy";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { buildInlineKeyboard } from "../utils/keyboard";
import { signClickToken } from "../utils/clickToken";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Kuzatuvli klaviatura: har tugma domen orqali `<webappUrl>/r/<token>` ga
// yo'naltiriladi. Server bosishni yozib, foydalanuvchini haqiqiy havolaga
// bir zumda (1 marta bosish) o'tkazadi. webappUrl bo'lmasa — oddiy tugmalar.
function buildTrackingKeyboard(
  chatId: number,
  buttons: IContentButton[],
  tracking: { sourceTag: string; order: number }
): InlineKeyboard | undefined {
  if (!buttons.length) return undefined;
  if (!env.webappUrl) return buildInlineKeyboard(buttons);

  const kb = new InlineKeyboard();
  buttons.forEach((b, i) => {
    const token = signClickToken({
      u: chatId,
      t: tracking.sourceTag,
      o: tracking.order,
      b: i,
    });
    kb.url(b.label, `${env.webappUrl}/r/${token}`);
    kb.row();
  });
  return kb;
}

export async function deliverContent(params: {
  api: Api;
  chatId: number;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
  tracking?: { sourceTag: string; order: number };
}): Promise<void> {
  const replyMarkup: InlineKeyboard | undefined = params.tracking
    ? buildTrackingKeyboard(params.chatId, params.buttons ?? [], params.tracking)
    : buildInlineKeyboard(params.buttons ?? []);

  const media = params.media ?? [];
  if (media.length) {
    const mediaItem = media[0];

    try {
      switch (mediaItem.type) {
        case "photo":
          await params.api.sendPhoto(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
        case "video":
          await params.api.sendVideo(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
        case "video_note":
          await params.api.sendVideoNote(params.chatId, mediaItem.file_id, {
            reply_markup: params.text ? undefined : replyMarkup,
          });
          if (params.text) {
            await params.api.sendMessage(params.chatId, params.text, {
              reply_markup: replyMarkup,
            });
          }
          return;
        case "voice":
          await params.api.sendVoice(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
        case "audio":
          await params.api.sendAudio(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
        case "animation":
          await params.api.sendAnimation(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
        default:
          await params.api.sendDocument(params.chatId, mediaItem.file_id, {
            caption: params.text,
            reply_markup: replyMarkup,
          });
          return;
      }
    } catch (error) {
      logger.warn("Media yuborib bo'lmadi, matnga o'tilmoqda", error);
    }
  }

  if (params.text) {
    await params.api.sendMessage(params.chatId, params.text, {
      reply_markup: replyMarkup,
    });
    return;
  }

  await params.api.sendMessage(params.chatId, "Kontent topilmadi.");
}
