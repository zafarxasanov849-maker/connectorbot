import { Bot, session, Composer } from "grammy";
import { env } from "../config/env";
import { BotContext, SessionData } from "./context";
import { startHandler } from "./handlers/start";
import { statsHandler, exportHandler, linksHandler } from "./handlers/admin";
import { handleFunnelCommand, handleFunnelCallback } from "./handlers/funnel";
import { handleDashboardCommand } from "./handlers/dashboard";
import {
  showAdminMenu,
  handleAdminMenuMessage,
} from "./handlers/adminMenu";
import { userMessageHandler } from "./handlers/userMessage";
import { isAdmin, seedAdmins } from "../services/adminService";
import {
  handleBroadcastCallback,
  handleBroadcastMessage,
  startBroadcastFlow,
} from "./flows/broadcastFlow";
import {
  handleSetContentCallback,
  handleSetContentMessage,
  startSetContentFlow,
} from "./flows/setContentFlow";
import {
  handleManageCallback,
  handleManageCommand,
  handleManageMessage,
} from "./flows/manageContentFlow";
import { logger } from "../utils/logger";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.botToken);

  bot.use(
    session({
      initial: (): SessionData => ({}),
    })
  );

  // /start hamma uchun ochiq.
  bot.command("start", startHandler);

  // --- Admin qismi ---
  const admin = new Composer<BotContext>();
  admin.command("admin", showAdminMenu);
  admin.command("stats", statsHandler);
  admin.command("export", exportHandler);
  admin.command("links", linksHandler);
  admin.command("funnel", handleFunnelCommand);
  admin.command("dashboard", handleDashboardCommand);
  admin.command("manage", (ctx) => handleManageCommand(ctx));
  admin.command("broadcast", (ctx) => startBroadcastFlow(ctx));
  admin.command("setcontent", (ctx) =>
    startSetContentFlow(ctx, ctx.match?.trim() || undefined)
  );

  admin.on("message", async (ctx) => {
    const handled =
      (await handleAdminMenuMessage(ctx)) ||
      (await handleBroadcastMessage(ctx)) ||
      (await handleSetContentMessage(ctx)) ||
      (await handleManageMessage(ctx));
    if (!handled) {
      await showAdminMenu(ctx);
    }
  });

  admin.on("callback_query:data", async (ctx) => {
    // Telegram'da tugmaning "yuklanish" holatini to'xtatamiz.
    await ctx.answerCallbackQuery().catch(() => {});
    await (
      (await handleBroadcastCallback(ctx)) ||
      (await handleSetContentCallback(ctx)) ||
      (await handleManageCallback(ctx)) ||
      (await handleFunnelCallback(ctx))
    );
  });

  // Admin composer FAQAT adminlar uchun ishlaydi.
  // Admin bo'lmaganlar uni chetlab, oddiy foydalanuvchi handleriga o'tadi.
  bot
    .filter(async (ctx) => {
      const id = ctx.from?.id;
      return id ? await isAdmin(id) : false;
    })
    .use(admin);

  // Oddiy (admin bo'lmagan) foydalanuvchilarning xabarlari — AmoCRM'ga yo'naltiriladi.
  bot.on("message", userMessageHandler);

  bot.catch((err) => {
    logger.error("Bot xatosi", err);
  });

  seedAdmins(
    env.adminIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
  ).catch((error) => logger.error("Adminlarni seed qilishda xato", error));

  return bot;
}
