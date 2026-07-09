import { BotContext } from "../context";
import { findOrCreateUser } from "../../services/userService";
import { getContentBySourceTag } from "../../services/contentService";
import { env } from "../../config/env";
import { scheduleSequenceMessages } from "../../services/sequenceService";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { resolveClickToken } from "../../services/clickService";
import { recordSequenceEvent } from "../../services/analyticsService";
import { InlineKeyboard } from "grammy";
import { logger } from "../../utils/logger";

export async function startHandler(ctx: BotContext): Promise<void> {
  const sourceTag =
    typeof ctx.match === "string"
      ? ctx.match.trim()
      : Array.isArray(ctx.match)
      ? ctx.match[1]?.trim()
      : undefined;

  try {
    const from = ctx.from;
    if (!from) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? 0,
        text: "Profil ma’lumotlari olinmadi.",
      });
      return;
    }

    // Klik havolasi (tugma bosilishi): k_ bilan boshlansa — bosishni yozib,
    // foydalanuvchini haqiqiy havolaga yo'naltiramiz.
    if (sourceTag && sourceTag.startsWith("k_")) {
      const link = await resolveClickToken(sourceTag);
      if (link) {
        await recordSequenceEvent({
          sourceTag: link.source_tag,
          telegramId: from.id,
          type: "clicked",
          order: link.order,
        });
        await enqueueTextMessage({
          chatId: ctx.chat?.id ?? from.id,
          text: "🔗 Havolani ochish uchun tugmani bosing:",
          replyMarkup: new InlineKeyboard().url(link.label || "Ochish", link.url),
        });
        return;
      }
      // token topilmasa — oddiy oqim davom etadi
    }

    const { user } = await findOrCreateUser(
      from.id,
      from.username ?? undefined,
      sourceTag
    );

    const content = await getContentBySourceTag(sourceTag);
    if (content) {
      // Schedule sequence messages relative to join time; works for new and returning users.
      await scheduleSequenceMessages({
        chatId: ctx.chat?.id ?? from.id,
        messages: content.messages ?? [],
        joinedAt: new Date(), // schedule from current start invocation
        sourceTag,
      });
      return;
    }

    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? from.id,
      text: env.defaultWelcome,
    });
  } catch (error) {
    logger.error("/start handlerida xato", error);
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? 0,
      text: "Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.",
    });
  }
}
