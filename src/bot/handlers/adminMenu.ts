import { Keyboard } from "grammy";
import { BotContext } from "../context";
import { enqueueTextMessage } from "../../services/messageQueueService";
import { statsHandler, exportHandler, linksHandler } from "./admin";
import { handleFunnelCommand } from "./funnel";
import { handleDashboardCommand } from "./dashboard";
import { startBroadcastFlow } from "../flows/broadcastFlow";
import { startSetContentFlow } from "../flows/setContentFlow";
import { handleManageCommand } from "../flows/manageContentFlow";

export const adminMenuLabels = {
  stats: "📊 Statistika",
  broadcast: "📤 Reklama",
  setcontent: "📦 Kontent qo‘shish",
  manage: "✏️ Tahrirlash/O‘chirish",
  links: "🔗 Havolalar",
  funnel: "📈 Voronka",
  dashboard: "📊 Dashboard",
  export: "⬇️ CSV eksport",
};

export async function showAdminMenu(ctx: BotContext): Promise<void> {
  ctx.session.broadcastFlow = undefined;
  ctx.session.setContentFlow = undefined;
  ctx.session.manageFlow = undefined;
  const kb = new Keyboard()
    .text(adminMenuLabels.stats)
    .text(adminMenuLabels.broadcast)
    .row()
    .text(adminMenuLabels.setcontent)
    .text(adminMenuLabels.manage)
    .row()
    .text(adminMenuLabels.links)
    .text(adminMenuLabels.funnel)
    .row()
    .text(adminMenuLabels.dashboard)
    .text(adminMenuLabels.export)
    .resized();

  await enqueueTextMessage({
    chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
    text: "Kerakli bo‘limni tanlang.",
    replyMarkup: kb,
  });
}

export async function handleAdminMenuMessage(
  ctx: BotContext
): Promise<boolean> {
  const text = ctx.message?.text;
  if (!text) return false;

  if (text === adminMenuLabels.stats) {
    await statsHandler(ctx);
    return true;
  }
  if (text === adminMenuLabels.broadcast) {
    await startBroadcastFlow(ctx);
    return true;
  }
  if (text === adminMenuLabels.setcontent) {
    await startSetContentFlow(ctx);
    return true;
  }
  if (text === adminMenuLabels.manage) {
    await handleManageCommand(ctx);
    return true;
  }
  if (text === adminMenuLabels.links) {
    await linksHandler(ctx);
    return true;
  }
  if (text === adminMenuLabels.funnel) {
    await handleFunnelCommand(ctx);
    return true;
  }
  if (text === adminMenuLabels.dashboard) {
    await handleDashboardCommand(ctx);
    return true;
  }
  if (text === adminMenuLabels.export) {
    await exportHandler(ctx);
    return true;
  }

  return false;
}
