import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { parseMessageText, extractMedia } from "../../utils/messageParser";
import {
  resolveRecipients,
  getQueue,
  queueBroadcast,
  countRecipients,
} from "../../services/broadcastService";
import { logAdminAction } from "../../services/adminLogService";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { listContentTags } from "../../services/contentService";

export async function startBroadcastFlow(ctx: BotContext): Promise<void> {
  ctx.session.broadcastFlow = { stage: "target", page: 0 };
  await renderTargetSelection(ctx, 0, false);
}

export async function handleBroadcastMessage(ctx: BotContext): Promise<boolean> {
  const flow = ctx.session.broadcastFlow;
  if (!flow) return false;

  if (flow.stage === "target") {
    // In target stage we expect button selection; ignore free text to avoid errors.
    await renderTargetSelection(ctx, flow.page ?? 0, false);
    return true;
  }

  if (flow.stage === "content") {
    if (flow.pendingMedia) {
      const media = extractMedia(ctx.message);
      if (!media.length || media[0].type !== flow.pendingMedia.expectedMediaType) {
        await enqueueTextMessage({
          chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
          text: `Kutilgan media turi: ${flow.pendingMedia.expectedMediaType}. Iltimos shu turdagi faylni yuboring.`,
        });
        return true;
      }

      ctx.session.broadcastFlow = {
        stage: "confirm",
        target: flow.target,
        text: flow.pendingMedia.text,
        media,
        buttons: flow.pendingMedia.buttons,
      };

      const confirmKeyboard = new InlineKeyboard()
        .text("Tasdiqlash", "broadcast_confirm")
        .text("Bekor qilish", "broadcast_cancel");

      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: `Oldindan ko‘rish:\nMaqsad: ${
          flow.target?.type === "all"
            ? "Barcha foydalanuvchilar"
            : `Tag: ${flow.target?.source_tag ?? ""}`
        }\nTugmalar: ${flow.pendingMedia.buttons.length}\nMedia: ${media[0].type}`,
        replyMarkup: confirmKeyboard,
      });
      return true;
    }

    const message = ctx.message;
    const text = message && "text" in message ? message.text : message?.caption;
    const { cleanedText, buttons, requestedMediaType } = parseMessageText(
      text ?? undefined
    );
    const media = extractMedia(message);

    if (
      requestedMediaType &&
      media.length &&
      media[0].type &&
      media[0].type !== requestedMediaType
    ) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: `Kutilgan media turi: ${requestedMediaType}, lekin ${media[0].type} yuborildi.`,
      });
      return true;
    }

    if (!cleanedText && !media.length && !requestedMediaType) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: "Yuborish uchun matn yoki media yuboring.",
      });
      return true;
    }

    if (requestedMediaType && !media.length) {
      ctx.session.broadcastFlow = {
        ...flow,
        pendingMedia: {
          text: cleanedText,
          buttons,
          expectedMediaType: requestedMediaType,
        },
      };
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: `Endi ${requestedMediaType} faylini yuboring.`,
      });
      return true;
    }

    ctx.session.broadcastFlow = {
      stage: "confirm",
      target: flow.target,
      text: cleanedText,
      media,
      buttons,
      pendingMedia: undefined,
    };

    const summary = `Oldindan ko‘rish:\nMaqsad: ${
      flow.target?.type === "all"
        ? "Barcha foydalanuvchilar"
        : `Tag: ${flow.target?.source_tag ?? ""}`
    }\nTugmalar: ${buttons.length}\nMedia: ${media.length ? media[0].type : "yo‘q"}`;

    const confirmKeyboard = new InlineKeyboard()
      .text("Tasdiqlash", "broadcast_confirm")
      .text("Bekor qilish", "broadcast_cancel");

    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: summary,
      replyMarkup: confirmKeyboard,
    });
    return true;
  }

  return false;
}

export async function handleBroadcastCallback(
  ctx: BotContext
): Promise<boolean> {
  const flow = ctx.session.broadcastFlow;
  if (!flow || !ctx.callbackQuery?.data) return false;

  if (ctx.callbackQuery.data.startsWith("broadcast_page:")) {
    const page = Number(ctx.callbackQuery.data.split(":")[1]);
    await renderTargetSelection(ctx, Number.isFinite(page) ? page : 0, true);
    flow.page = Number.isFinite(page) ? page : 0;
    ctx.session.broadcastFlow = flow;
    return true;
  }

  if (ctx.callbackQuery.data.startsWith("broadcast_target:")) {
    const targetValue = ctx.callbackQuery.data.split(":")[1];
    const target =
      targetValue === "all"
        ? { type: "all" as const }
        : { type: "source" as const, source_tag: targetValue };

    const recipientCount = await countRecipients(target);
    if (!recipientCount) {
      await ctx.editMessageText(
        "Bu tanlov uchun foydalanuvchi topilmadi. Boshqa tagni tanlang."
      );
      return true;
    }

    ctx.session.broadcastFlow = {
      ...flow,
      target,
      stage: "content",
      pendingMedia: undefined,
    };
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: [
        "Reklama matnini yuboring.",
        "Matn va bitta media (foto/video/dumaloq video/hujjat/voice) qo‘shishingiz mumkin.",
        "Tugma formati: Sarlavha - https://link",
        "Dumaloq video uchun avval matnda MEDIA: video_note yozing, keyin videoni yuboring.",
      ].join("\n"),
    });
    return true;
  }

  if (flow.stage !== "confirm") return false;

  if (ctx.callbackQuery.data === "broadcast_cancel") {
    await ctx.editMessageText("Yuborish bekor qilindi.");
    ctx.session.broadcastFlow = undefined;
    return true;
  }

  if (ctx.callbackQuery.data === "broadcast_confirm") {
    const target = flow.target ?? { type: "all" as const };
    const recipients = await resolveRecipients(target);
    if (!recipients.length) {
      await ctx.editMessageText("Ushbu maqsad uchun foydalanuvchi topilmadi.");
      ctx.session.broadcastFlow = undefined;
      return true;
    }

    const queue = getQueue();
    await queueBroadcast(queue, recipients, {
      text: flow.text,
      media: flow.media,
      buttons: flow.buttons,
    });

    await logAdminAction({
      adminId: ctx.from?.id ?? 0,
      action: "broadcast",
      target: target.type === "all" ? "all" : `source:${target.source_tag}`,
    });

    await ctx.editMessageText(
      `${recipients.length} ta foydalanuvchiga yuborish navbatga qo‘yildi.`
    );
    ctx.session.broadcastFlow = undefined;
    return true;
  }

  return false;
}

async function renderTargetSelection(
  ctx: BotContext,
  page: number,
  edit: boolean
): Promise<void> {
  const tags = await listContentTags();
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(tags.length / perPage));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * perPage;
  const slice = tags.slice(start, start + perPage);

  const kb = new InlineKeyboard();
  kb.text("✅ Hammasi", "broadcast_target:all").row();

  slice.forEach((tag, idx) => {
    kb.text(tag, `broadcast_target:${tag}`);
    if (idx % 2 === 1) kb.row();
  });

  if (totalPages > 1) {
    kb.row();
    if (safePage > 0) kb.text("◀️ Oldingi", `broadcast_page:${safePage - 1}`);
    kb.text(`📄 ${safePage + 1}/${totalPages}`, `broadcast_page:${safePage}`);
    if (safePage < totalPages - 1) kb.text("Keyingi ▶️", `broadcast_page:${safePage + 1}`);
  }

  const text =
    "Yuborish auditoriyasini tanlang: tagni tanlang yoki \"Hammasi\" ni bosing.";

  if (edit && ctx.callbackQuery?.message?.message_id) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text,
      replyMarkup: kb,
    });
  }
}
