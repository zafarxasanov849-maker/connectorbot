import { BotContext } from "../context";
import { getUserCountBySource, getAllUsers } from "../../services/userService";
import { usersToCsv } from "../../utils/csv";
import { listContentTags } from "../../services/contentService";
import {
  enqueueDocumentMessage,
  enqueueTextMessage,
} from "../../services/messageQueueService";

export async function statsHandler(ctx: BotContext): Promise<void> {
  const breakdown = await getUserCountBySource();
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  const lines = breakdown
    .map(
      (item) =>
        `${item.source_tag ? item.source_tag : "Noma'lum"}: ${item.count} ta`
    )
    .join("\n");
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: `Foydalanuvchilar: ${total} ta\n\n${lines}`,
  });
}

export async function exportHandler(ctx: BotContext): Promise<void> {
  const users = await getAllUsers();
  const csv = usersToCsv(users);
  const buffer = Buffer.from(csv);

  await enqueueDocumentMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    filename: "users.csv",
    data: buffer,
    caption: "Foydalanuvchilar ro‘yxati CSV",
  });
}

export async function linksHandler(ctx: BotContext): Promise<void> {
  const tags = await listContentTags();
  if (!tags.length) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Hali taglar uchun kontent mavjud emas.",
    });
    return;
  }

  const username = ctx.me?.username;
  if (!username) {
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Bot username aniqlanmagan. BOT_USERNAME ni sozlang yoki keyinroq urinib ko‘ring.",
    });
    return;
  }

  const links = tags.map(
    (tag) => `t.me/${username}?start=${encodeURIComponent(tag)}`
  );
  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: [
      "Taglar va havolalar:",
      ...links.map((link, idx) => `${tags[idx]} - ${link}`),
    ].join("\n"),
  });
}
