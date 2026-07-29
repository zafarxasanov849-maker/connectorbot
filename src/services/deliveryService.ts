import { Api, InlineKeyboard, InputMediaBuilder } from "grammy";
import { IMediaFile, IContentButton } from "../models/ContentPackage";
import { buildInlineKeyboard } from "../utils/keyboard";
import { signClickToken } from "../utils/clickToken";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export type TrackingInfo =
  | { kind: "sequence"; sourceTag: string; order: number }
  | { kind: "broadcast"; broadcastId: string };

// Kuzatuvli klaviatura: har tugma domen orqali `<webappUrl>/r/<token>` ga
// yo'naltiriladi. Server bosishni yozib, foydalanuvchini haqiqiy havolaga
// bir zumda (1 marta bosish) o'tkazadi. webappUrl bo'lmasa — oddiy tugmalar.
function buildTrackingKeyboard(
  chatId: number,
  buttons: IContentButton[],
  tracking: TrackingInfo
): InlineKeyboard | undefined {
  if (!buttons.length) return undefined;
  if (!env.webappUrl) return buildInlineKeyboard(buttons);

  const kb = new InlineKeyboard();
  buttons.forEach((b, i) => {
    const token = signClickToken(
      tracking.kind === "sequence"
        ? { k: "s", u: chatId, t: tracking.sourceTag, o: tracking.order, b: i }
        : { k: "b", u: chatId, id: tracking.broadcastId, b: i }
    );
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
  tracking?: TrackingInfo;
}): Promise<void> {
  const replyMarkup: InlineKeyboard | undefined = params.tracking
    ? buildTrackingKeyboard(params.chatId, params.buttons ?? [], params.tracking)
    : buildInlineKeyboard(params.buttons ?? []);

  const media = params.media ?? [];

  // Albom (2+ media) — sendMediaGroup. Albomga tugma qo'yib bo'lmaydi,
  // shuning uchun tugmalar (bo'lsa) alohida xabarda yuboriladi.
  if (media.length > 1) {
    try {
      const group = media.slice(0, 10).map((m, i) => {
        const opts = i === 0 && params.text ? { caption: params.text } : {};
        return m.type === "video"
          ? InputMediaBuilder.video(m.file_id, opts)
          : InputMediaBuilder.photo(m.file_id, opts);
      });
      await params.api.sendMediaGroup(params.chatId, group);
      if (replyMarkup) {
        await params.api.sendMessage(params.chatId, "👇", {
          reply_markup: replyMarkup,
        });
      }
      return;
    } catch (error) {
      logger.warn("Albom yuborib bo'lmadi, bitta media bilan davom etamiz", error);
    }
  }

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
