import { Api, InlineKeyboard } from "grammy";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { buildInlineKeyboard } from "../utils/keyboard";
import { getOrCreateClickToken } from "./clickService";
import { logger } from "../utils/logger";

// Bot username'ini bir marta olib keshlaymiz (kuzatuv havolalari uchun).
let cachedUsername: string | undefined;
async function getBotUsername(api: Api): Promise<string | undefined> {
  if (cachedUsername) return cachedUsername;
  try {
    cachedUsername = (await api.getMe()).username;
  } catch {
    return undefined;
  }
  return cachedUsername;
}

// Kuzatuvli klaviatura: har tugma botga qaytadigan `t.me/bot?start=<token>`
// havolasiga aylanadi. Username olinmasa, oddiy URL-tugmalarga qaytamiz.
async function buildTrackingKeyboard(
  api: Api,
  buttons: IContentButton[],
  tracking: { sourceTag: string; order: number }
): Promise<InlineKeyboard | undefined> {
  if (!buttons.length) return undefined;
  const username = await getBotUsername(api);
  if (!username) return buildInlineKeyboard(buttons);

  const kb = new InlineKeyboard();
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const token = await getOrCreateClickToken({
      sourceTag: tracking.sourceTag,
      order: tracking.order,
      buttonIndex: i,
      url: b.url,
      label: b.label,
    });
    kb.url(b.label, `https://t.me/${username}?start=${token}`);
    kb.row();
  }
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
    ? await buildTrackingKeyboard(params.api, params.buttons ?? [], params.tracking)
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
