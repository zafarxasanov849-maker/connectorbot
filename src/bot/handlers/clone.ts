import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { cloneContentPackage } from "../../services/contentService";
import { logAdminAction } from "../../services/adminLogService";
import { isValidTag, TAG_HINT } from "../../utils/tag";

// /clone <manba_tag> <yangi_tag> — mavjud ketma-ketlikni yangi tagga ko'chiradi.
export async function handleCloneCommand(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id ?? ctx.from?.id ?? 0;
  const parts = (typeof ctx.match === "string" ? ctx.match : "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    await enqueueTextMessage({
      chatId,
      text: [
        "Foydalanish: /clone <manba_tag> <yangi_tag>",
        "Masalan: /clone instagram instagram_v2",
        "",
        "Bu manba kontentini yangi tagga nusxalaydi (analitika alohida boshlanadi).",
      ].join("\n"),
    });
    return;
  }

  const [fromTag, toTag] = parts;
  if (!isValidTag(toTag)) {
    await enqueueTextMessage({ chatId, text: TAG_HINT });
    return;
  }

  const res = await cloneContentPackage(fromTag, toTag);
  if (!res.ok && res.reason === "not_found") {
    await enqueueTextMessage({
      chatId,
      text: `"${fromTag}" tagi topilmadi. /links orqali mavjud taglarni ko‘ring.`,
    });
    return;
  }
  if (!res.ok && res.reason === "exists") {
    await enqueueTextMessage({
      chatId,
      text: `"${toTag}" allaqachon mavjud. Boshqa nom tanlang yoki /manage orqali o‘chiring.`,
    });
    return;
  }

  await logAdminAction({
    adminId: ctx.from?.id ?? 0,
    action: "clone",
    target: `${fromTag}->${toTag}`,
  });

  const username = ctx.me?.username;
  const link = username ? `\nHavola: t.me/${username}?start=${toTag}` : "";
  await enqueueTextMessage({
    chatId,
    text: [
      `✅ "${fromTag}" → "${toTag}" ga ${res.count} ta xabar nusxalandi.`,
      link,
      `\nTahrirlash: /setcontent ${toTag}`,
    ].join(""),
  });
}
