import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import {
  getPackageWithMessages,
  updateSequenceMessages,
  listContentTags,
  deleteContentPackage,
} from "../../services/contentService";
import { parseSequenceMessage } from "../../utils/sequenceParser";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { extractMedia } from "../../utils/messageParser";

function buildMessageListText(messages: any[]): string {
  if (!messages.length) return "Hali xabarlar sozlanmagan.";
  return messages
    .map((m, idx) => {
      const mediaType = m.media_files?.[0]?.type ?? "yo‘q";
      const textPreview = m.text_message
        ? m.text_message.slice(0, 60)
        : "matn yo‘q";
      return `#${idx + 1} | ${
        m.delay_minutes
      } daq. | media: ${mediaType} | matn: ${textPreview}`;
    })
    .join("\n");
}

export async function handleManageCommand(ctx: BotContext): Promise<void> {
  const tags = await listContentTags();
  if (!tags.length) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Hali taglar uchun kontent yo‘q.",
    });
    return;
  }
  const kb = new InlineKeyboard();
  tags.forEach((tag) => kb.text(tag, `manage_tag:${tag}`).row());
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: "Qaysi tagdagi xabarlarni tahrirlaysiz?",
    replyMarkup: kb,
  });
}

export async function handleManageCallback(ctx: BotContext): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  if (data.startsWith("manage_tag:")) {
    const sourceTag = data.split(":")[1];
    const pkg = await getPackageWithMessages(sourceTag);
    if (!pkg) {
      await ctx.editMessageText("Kontent topilmadi.");
      return true;
    }
    const kb = new InlineKeyboard()
      .text("Tahrirlash", `manage_edit:${sourceTag}`)
      .text("O‘chirish", `manage_delete:${sourceTag}`)
      .row()
      .text("🗑 Tagni to‘liq o‘chirish", `manage_delete_tag:${sourceTag}`)
      .row();
    await ctx.editMessageText(
      `"${sourceTag}" uchun xabarlar:\n\n${buildMessageListText(
        pkg.messages ?? []
      )}`,
      { reply_markup: kb }
    );
    ctx.session.manageFlow = { sourceTag };
    return true;
  }

  if (data.startsWith("manage_edit:")) {
    const sourceTag = data.split(":")[1];
    const pkg = await getPackageWithMessages(sourceTag);
    if (!pkg) {
      await ctx.editMessageText("Kontent topilmadi.");
      return true;
    }
    const kb = new InlineKeyboard();
    (pkg.messages ?? []).forEach((_, idx) =>
      kb.text(`#${idx + 1}`, `manage_edit_pick:${sourceTag}:${idx}`).row()
    );
    await ctx.editMessageText("Qaysi xabarni tahrirlaysiz?", {
      reply_markup: kb,
    });
    return true;
  }

  if (data.startsWith("manage_delete:")) {
    const sourceTag = data.split(":")[1];
    const pkg = await getPackageWithMessages(sourceTag);
    if (!pkg) {
      await ctx.editMessageText("Kontent topilmadi.");
      return true;
    }
    const kb = new InlineKeyboard();
    (pkg.messages ?? []).forEach((_, idx) =>
      kb.text(`#${idx + 1}`, `manage_delete_pick:${sourceTag}:${idx}`).row()
    );
    await ctx.editMessageText("Qaysi xabarni o‘chirasiz?", {
      reply_markup: kb,
    });
    return true;
  }

  if (data.startsWith("manage_delete_pick:")) {
    const [, sourceTag, idxStr] = data.split(":");
    const index = Number(idxStr);
    const pkg = await getPackageWithMessages(sourceTag);
    if (!pkg?.messages) {
      await ctx.editMessageText("Kontent topilmadi.");
      return true;
    }
    pkg.messages.splice(index, 1);
    const updated = await updateSequenceMessages({
      sourceTag,
      messages: pkg.messages,
    });
    await ctx.editMessageText(
      `#${index + 1} xabar o‘chirildi.\n\n${buildMessageListText(
        updated?.messages ?? []
      )}`
    );
    return true;
  }

  if (data.startsWith("manage_delete_tag:")) {
    const [, sourceTag] = data.split(":");
    const pkg = await getPackageWithMessages(sourceTag);
    const count = pkg?.messages?.length ?? 0;
    const kb = new InlineKeyboard()
      .text("✅ Ha, o‘chirish", `manage_delete_tag_confirm:${sourceTag}`)
      .text("❌ Bekor", `manage_tag:${sourceTag}`);
    ctx.session.manageFlow = { sourceTag, mode: "delete_tag_confirm" };
    await ctx.editMessageText(
      `"${sourceTag}" tagi va uning ${count} ta xabari to‘liq o‘chiriladi. Tasdiqlaysizmi?`,
      { reply_markup: kb }
    );
    return true;
  }

  if (data.startsWith("manage_delete_tag_confirm:")) {
    const [, sourceTag] = data.split(":");
    const deleted = await deleteContentPackage(sourceTag);
    await ctx.editMessageText(
      deleted
        ? `"${sourceTag}" tagi va ${deleted.messages?.length ?? 0} ta xabari o‘chirildi.`
        : "Kontent topilmadi."
    );
    ctx.session.manageFlow = undefined;
    return true;
  }

  if (data.startsWith("manage_edit_pick:")) {
    const [, sourceTag, idxStr] = data.split(":");
    const index = Number(idxStr);
    ctx.session.manageFlow = {
      sourceTag,
      mode: "edit",
      messageIndex: index,
      pendingMessage: undefined,
    };
    await ctx.editMessageText(
      [
        `#${index + 1} o‘rniga yangi xabar yuboring.`,
        "Format:",
        "<kechikish daqiqada>",
        "<matn; ixtiyoriy media>",
        "Tugma: Sarlavha - https://url",
        "Dumaloq video uchun: MEDIA: video_note, keyin videoni yuboring.",
      ].join("\n")
    );
    return true;
  }

  return false;
}

export async function handleManageMessage(ctx: BotContext): Promise<boolean> {
  const flow = ctx.session.manageFlow;
  if (!flow || flow.mode !== "edit" || flow.messageIndex === undefined)
    return false;

  if (flow.pendingMessage) {
    const media = extractMedia(ctx.message);
    if (!media.length || media[0].type !== flow.pendingMessage.expectedMediaType) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: `Kutilgan media turi: ${flow.pendingMessage.expectedMediaType}. Iltimos shu turdagi faylni yuboring.`,
      });
      return true;
    }

    const pkg = await getPackageWithMessages(flow.sourceTag ?? "");
    if (!pkg?.messages) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: "Kontent topilmadi.",
      });
      ctx.session.manageFlow = undefined;
      return true;
    }

    pkg.messages[flow.messageIndex] = {
      delay_minutes: flow.pendingMessage.delay_minutes,
      text_message: flow.pendingMessage.text,
      media_files: media,
      buttons: flow.pendingMessage.buttons,
      order: flow.messageIndex,
    };

    const updated = await updateSequenceMessages({
      sourceTag: flow.sourceTag ?? "",
      messages: pkg.messages,
    });
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: `#${flow.messageIndex + 1} xabar yangilandi ("${
        flow.sourceTag
      }").\n\n${buildMessageListText(updated?.messages ?? [])}`,
    });
    ctx.session.manageFlow = undefined;
    return true;
  }

  const parsed = parseSequenceMessage(ctx.message);
  if (parsed.error || !parsed.sequence) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text:
        (parsed.error ?? "Could not parse message.") +
        "\nNamuna:\n30\nUpdated text\nBuy - https://example.com",
    });
      return true;
  }
  if (parsed.awaitingMediaType) {
    ctx.session.manageFlow = {
      ...flow,
      pendingMessage: {
        delay_minutes: parsed.sequence.delay_minutes,
        text: parsed.sequence.text_message,
        buttons: parsed.sequence.buttons,
        expectedMediaType: parsed.awaitingMediaType,
      },
    };
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: `Endi ${parsed.awaitingMediaType} faylini yuboring.`,
    });
    return true;
  }
  const pkg = await getPackageWithMessages(flow.sourceTag ?? "");
  if (!pkg?.messages) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Kontent topilmadi.",
    });
    ctx.session.manageFlow = undefined;
    return true;
  }
  pkg.messages[flow.messageIndex] = {
    ...parsed.sequence,
    order: flow.messageIndex,
  };
  const updated = await updateSequenceMessages({
    sourceTag: flow.sourceTag ?? "",
    messages: pkg.messages,
  });
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: `#${flow.messageIndex + 1} xabar yangilandi ("${
      flow.sourceTag
    }").\n\n${buildMessageListText(updated?.messages ?? [])}`,
  });
  ctx.session.manageFlow = undefined;
  return true;
}
