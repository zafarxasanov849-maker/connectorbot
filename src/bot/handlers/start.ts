import { BotContext } from "../context";
import { findOrCreateUser } from "../../services/userService";
import { getContentBySourceTag } from "../../services/contentService";
import { env } from "../../config/env";
import { scheduleSequenceMessages } from "../../services/sequenceService";
import { enqueueTextMessage } from "../../services/messageQueueService";

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
      });
      return;
    }

    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? from.id,
      text: env.defaultWelcome,
    });
  } catch (error) {
    console.error("Error in /start handler", error);
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? 0,
      text: "Xatolik yuz berdi, iltimos keyinroq urinib ko‘ring.",
    });
  }
}
