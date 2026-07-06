import { Bot, session, Composer } from "grammy";
import { env } from "../config/env";
import { BotContext, SessionData } from "./context";
import { startHandler } from "./handlers/start";
import { adminOnly } from "./middleware/adminOnly";
import { statsHandler, exportHandler, linksHandler } from "./handlers/admin";
import { enqueueTextMessage } from "../services/messageQueueService";
import {
  showAdminMenu,
  handleAdminMenuMessage,
} from "./handlers/adminMenu";
import { seedAdmins } from "../services/adminService";
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

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.botToken);

  bot.use(
    session({
      initial: (): SessionData => ({}),
    })
  );

  bot.command("start", startHandler);

  const admin = new Composer<BotContext>();
  admin.use(adminOnly);
  admin.command("admin", showAdminMenu);
  admin.command("stats", statsHandler);
  admin.command("export", exportHandler);
  admin.command("links", linksHandler);
  admin.command("manage", async (ctx) => handleManageCommand(ctx));
  admin.command("broadcast", async (ctx) => startBroadcastFlow(ctx));
  admin.command("setcontent", (ctx) => {
    const tag = ctx.match?.trim();
    return startSetContentFlow(ctx, tag);
  });

  // Flow handlers (admin only)
  admin.on("message", async (ctx, next) => {
    const handled =
      (await handleAdminMenuMessage(ctx)) ||
      (await handleBroadcastMessage(ctx)) ||
      (await handleSetContentMessage(ctx)) ||
      (await handleManageMessage(ctx));
    if (!handled) {
      await showAdminMenu(ctx);
      return;
    }
    return;
  });

  admin.on("callback_query:data", async (ctx, next) => {
    const handled =
      (await handleBroadcastCallback(ctx)) ||
      (await handleSetContentCallback(ctx)) ||
      (await handleManageCallback(ctx));
    if (!handled) return next();
  });

  bot.use(admin);

  bot.catch((err) => {
    console.error("Bot error", err);
  });

  bot.use(async (ctx) => {
    if (ctx.message?.text?.startsWith("/")) return;
    await enqueueTextMessage({
      chatId: ctx.chat?.id ?? ctx.from?.id ?? 0,
      text: "Noma’lum buyruq. Menyudan foydalaning yoki /start ni yuboring.",
    });
  });

  seedAdmins(
    env.adminIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  ).catch((error) => console.error("Failed to seed admins", error));

  return bot;
}
