import { Api, InlineKeyboard } from "grammy";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { buildInlineKeyboard } from "../utils/keyboard";
import { logger } from "../utils/logger";

export async function deliverContent(params: {
  api: Api;
  chatId: number;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
}): Promise<void> {
  const replyMarkup: InlineKeyboard | undefined = buildInlineKeyboard(
    params.buttons ?? []
  );

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
