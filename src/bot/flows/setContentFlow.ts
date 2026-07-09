import { InlineKeyboard } from "grammy";
import { BotContext } from "../context";
import { setContentPackage } from "../../services/contentService";
import { logAdminAction } from "../../services/adminLogService";
import { parseSequenceMessage } from "../../utils/sequenceParser";
import { enqueueTextMessage } from "../../services/messageQueueService";
import {
  listContentTags,
  getPackageWithMessages,
} from "../../services/contentService";
import { deliverContent } from "../../services/deliveryService";
import { extractMedia } from "../../utils/messageParser";
import { isValidTag, TAG_HINT } from "../../utils/tag";

async function buildSetContentState(sourceTag?: string) {
  const existing = sourceTag ? await getPackageWithMessages(sourceTag) : null;
  return {
    stage: "content" as const,
    sourceTag,
    messages: existing?.messages ?? [],
    pendingMessage: undefined,
  };
}

function buildSetContentIntro(sourceTag: string, existingCount: number): string {
  return [
    `"${sourceTag}" uchun kontent tayyorlanmoqda.`,
    existingCount
      ? `Mavjud ${existingCount} ta xabar yuklandi. Yangi xabarlar ularga qo‘shiladi.`
      : "Bu tag uchun hali xabar yo‘q. Birinchi xabarni kiriting.",
    "Har bir xabar uchun format:",
    "1) 1-qator: kechikish daqiqada (masalan, 30)",
    "2) Keyingi qatorlar: matn; xohlasangiz media biriktiring.",
    "3) Tugmalar (istalgan qatorda):",
    "   Sarlavha - https://url",
    "4) Dumaloq video uchun:",
    "   MEDIA: video_note",
    "   keyin bot so‘raganda dumaloq videoni yuboring.",
    "Har bir xabardan so‘ng tasdiqlash oynasi chiqadi.",
  ].join("\n");
}

async function finalizeSequenceMessage(
  ctx: BotContext,
  flow: NonNullable<BotContext["session"]["setContentFlow"]>,
  sequence: NonNullable<ReturnType<typeof parseSequenceMessage>["sequence"]>
): Promise<void> {
  const messages = flow.messages ?? [];
  sequence.order = messages.length;
  messages.push(sequence);
  ctx.session.setContentFlow = {
    ...flow,
    messages,
    pendingMessage: undefined,
    stage: "confirm",
  };

  await deliverContent({
    api: ctx.api,
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: sequence.text_message,
    media: sequence.media_files,
    buttons: sequence.buttons,
  });

  const confirmKeyboard = new InlineKeyboard()
    .text("✅ Saqlash", "setcontent_confirm")
    .text("➕ Yana qo‘shish", "setcontent_add_more")
    .row()
    .text("❌ Bekor", "setcontent_cancel");

  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: [
      `Hozirgi ketma-ketlik: ${messages.length} ta xabar.`,
      "Oxirgi xabar yuqorida ko‘rsatildi (shu ko‘rinishda yuboriladi).",
      "Tanlang:",
      "✅ Saqlash — ketma-ketlikni saqlash",
      "➕ Yana qo‘shish — navbatdagi xabarni kiritish",
      "❌ Bekor — o‘zgarishlarni bekor qilish",
    ].join("\n"),
    replyMarkup: confirmKeyboard,
  });
}

export async function startSetContentFlow(
  ctx: BotContext,
  sourceTag?: string
): Promise<void> {
  // Clear other flows to avoid cross-trigger (e.g., old broadcast target prompts)
  ctx.session.broadcastFlow = undefined;
  ctx.session.setContentFlow = {
    stage: "source",
    sourceTag,
    messages: [],
    pendingMessage: undefined,
  };
  if (!sourceTag) {
    await renderTagSelection(ctx);
  } else if (!isValidTag(sourceTag)) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: TAG_HINT,
    });
    await renderTagSelection(ctx);
  } else {
    const nextFlow = await buildSetContentState(sourceTag);
    ctx.session.setContentFlow = nextFlow;
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: buildSetContentIntro(sourceTag, nextFlow.messages?.length ?? 0),
    });
  }
}

export async function handleSetContentMessage(
  ctx: BotContext
): Promise<boolean> {
  const flow = ctx.session.setContentFlow;
  if (!flow) return false;

  if (flow.stage === "source") {
    const sourceTag =
      ("text" in (ctx.message ?? {}) && ctx.message?.text?.trim()) || undefined;
    if (!sourceTag) {
      await renderTagSelection(ctx);
      return true;
    }
    if (!isValidTag(sourceTag)) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text: TAG_HINT,
      });
      return true;
    }
    const nextFlow = await buildSetContentState(sourceTag);
    ctx.session.setContentFlow = nextFlow;
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: buildSetContentIntro(sourceTag, nextFlow.messages?.length ?? 0),
    });
    return true;
  }

  if (flow.stage === "content") {
    if (flow.pendingMessage) {
      const media = extractMedia(ctx.message);
      if (!media.length || media[0].type !== flow.pendingMessage.expectedMediaType) {
        await enqueueTextMessage({
          chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
          text: `Kutilgan media turi: ${flow.pendingMessage.expectedMediaType}. Iltimos shu turdagi faylni yuboring.`,
        });
        return true;
      }

      await finalizeSequenceMessage(ctx, flow, {
        delay_minutes: flow.pendingMessage.delay_minutes,
        text_message: flow.pendingMessage.text,
        media_files: media,
        buttons: flow.pendingMessage.buttons,
        order: undefined,
      });
      return true;
    }

    const parsed = parseSequenceMessage(ctx.message);
    if (parsed.error || !parsed.sequence) {
      await enqueueTextMessage({
        chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
        text:
          (parsed.error ?? "Xabarni o‘qib bo‘lmadi.") +
          "\nNamuna:\n30\nSotib olish uchun bosing\nSarlavha - https://example.com",
      });
      return true;
    }

    if (parsed.awaitingMediaType) {
      ctx.session.setContentFlow = {
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

    await finalizeSequenceMessage(ctx, flow, parsed.sequence);
    return true;
  }

  return false;
}

export async function handleSetContentCallback(
  ctx: BotContext
): Promise<boolean> {
  const flow = ctx.session.setContentFlow;
  if (!flow || !ctx.callbackQuery?.data) return false;

  if (ctx.callbackQuery.data.startsWith("setcontent_pick:")) {
    const tag = ctx.callbackQuery.data.split(":")[1];
    ctx.session.broadcastFlow = undefined;
    const nextFlow = await buildSetContentState(tag);
    ctx.session.setContentFlow = nextFlow;
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: buildSetContentIntro(tag, nextFlow.messages?.length ?? 0),
    });
    return true;
  }

  if (ctx.callbackQuery.data === "setcontent_new") {
    ctx.session.broadcastFlow = undefined;
    ctx.session.setContentFlow = {
      stage: "source",
      sourceTag: undefined,
      messages: [],
      pendingMessage: undefined,
    };
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Yangi tag nomini yuboring (masalan, instagram2024).",
    });
    return true;
  }

  if (flow.stage !== "confirm") return false;

  if (ctx.callbackQuery.data === "setcontent_cancel") {
    await ctx.editMessageText("Kontent saqlash bekor qilindi.");
    ctx.session.setContentFlow = undefined;
    return true;
  }

  if (ctx.callbackQuery.data === "setcontent_add_more") {
    if (!flow.sourceTag) {
      await ctx.editMessageText("Tag ko‘rsatilmagan.");
      ctx.session.setContentFlow = undefined;
      return true;
    }
    ctx.session.setContentFlow = {
      stage: "content",
      sourceTag: flow.sourceTag,
      messages: flow.messages ?? [],
      pendingMessage: undefined,
    };
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: [
        `"${flow.sourceTag}" uchun yangi xabar yuboring.`,
        "Format:",
        "1) 1-qator: kechikish daqiqada (masalan, 30)",
        "2) Keyingi qatorlar: matn; xohlasangiz media biriktiring.",
        "3) Tugma: Sarlavha - https://url",
        "4) Dumaloq video uchun: MEDIA: video_note, keyin videoni yuboring.",
      ].join("\n"),
    });
    return true;
  }

  if (ctx.callbackQuery.data === "setcontent_confirm") {
    if (!flow.sourceTag) {
      await ctx.editMessageText("Tag ko‘rsatilmagan.");
      ctx.session.setContentFlow = undefined;
      return true;
    }

    await setContentPackage({
      sourceTag: flow.sourceTag,
      messages: flow.messages ?? [],
    });

    await logAdminAction({
      adminId: ctx.from?.id ?? 0,
      action: "setcontent",
      target: flow.sourceTag,
    });

    await ctx.editMessageText(
      `"${flow.sourceTag}" uchun ${
        flow.messages?.length ?? 0
      } ta xabar saqlandi.`
    );
    ctx.session.setContentFlow = undefined;
    return true;
  }

  return false;
}

async function renderTagSelection(ctx: BotContext): Promise<void> {
  const tags = await listContentTags();
  const kb = new InlineKeyboard();
  kb.text("🆕 Yangi tag", "setcontent_new").row();
  tags.forEach((tag, idx) => {
    kb.text(tag, `setcontent_pick:${tag}`);
    if (idx % 2 === 1) kb.row();
  });
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: "Tagni tanlang yoki yangi tag yarating:",
    replyMarkup: kb,
  });
}
