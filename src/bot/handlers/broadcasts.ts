import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { getRecentBroadcasts } from "../../services/broadcastService";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(5, 16).replace("T", " ");
}

// /broadcasts — oxirgi reklamalar hisoboti: yetkazildi / xato / bosilgan.
export async function handleBroadcastsCommand(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id ?? ctx.from?.id ?? 0;
  const list = await getRecentBroadcasts(10);

  if (!list.length) {
    await enqueueTextMessage({
      chatId,
      text: "Hali reklama yuborilmagan.",
    });
    return;
  }

  const lines = list.map((b, i) => {
    const clicks = b.clickers?.length ?? 0;
    const target = b.target === "all" ? "Hammasi" : b.target.replace("source:", "");
    const preview = b.text_preview ? `\n   “${b.text_preview.slice(0, 40)}…”` : "";
    return (
      `${i + 1}. ${fmtDate(b.created_at)} · ${target}${preview}\n` +
      `   ✅ ${b.delivered}/${b.total} yetdi · ❌ ${b.failed} xato · 👆 ${clicks} bosdi`
    );
  });

  await enqueueTextMessage({
    chatId,
    text: "📣 Oxirgi reklamalar:\n\n" + lines.join("\n\n"),
  });
}
