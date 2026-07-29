import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { env } from "../config/env";
import { validateInitData } from "./auth";
import { isAdmin } from "../services/adminService";
import { listContentTags, getPackageWithMessages } from "../services/contentService";
import {
  getFunnel,
  getTrend,
  getOverview,
  recordSequenceEvent,
} from "../services/analyticsService";
import {
  getBroadcastButtonUrl,
  addBroadcastClicker,
} from "../services/broadcastService";
import { verifyClickToken } from "../utils/clickToken";
import { logger } from "../utils/logger";

// Funnel dashboard (Telegram Mini App) uchun web-server.
export function startWebServer(): void {
  const port = Number(process.env.WEB_PORT) || 3000;
  const app = express();
  app.use(express.json());

  // Klik-yo'naltirish (ochiq): bosishni yozib, haqiqiy havolaga 302 qiladi.
  // Ikki tur: broadcast (k="b") va sequence (aks holda).
  app.get("/r/:token", async (req: Request, res: Response) => {
    const p = verifyClickToken(req.params.token);
    if (!p) {
      res.status(400).send("Invalid link");
      return;
    }

    let url: string | null | undefined;
    if (p.k === "b") {
      url = await getBroadcastButtonUrl(p.id, p.b);
      if (url) void addBroadcastClicker(p.id, p.u);
    } else {
      const pkg = await getPackageWithMessages(p.t);
      url = pkg?.messages?.[p.o]?.buttons?.[p.b]?.url;
      if (url) {
        void recordSequenceEvent({
          sourceTag: p.t,
          telegramId: p.u,
          type: "clicked",
          order: p.o,
          buttonIndex: p.b,
        });
      }
    }

    if (!url) {
      res.status(404).send("Link not found");
      return;
    }
    res.redirect(302, url);
  });

  // Ruxsat: Telegram Mini App (admin) YOKI to'g'ri brauzer-kaliti.
  const auth = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const key =
      (req.query.key as string | undefined) ??
      req.header("X-Dashboard-Key") ??
      "";
    if (env.dashboardKey && key === env.dashboardKey) {
      next();
      return;
    }

    const initData = req.header("X-Telegram-Init-Data") ?? "";
    const { ok, userId } = validateInitData(initData, env.botToken);
    if (!ok || !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!(await isAdmin(userId))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };

  app.get("/api/tags", auth, async (_req: Request, res: Response) => {
    res.json({ tags: await listContentTags() });
  });

  app.get("/api/overview", auth, async (_req: Request, res: Response) => {
    res.json(await getOverview());
  });

  app.get("/api/funnel/:tag", auth, async (req: Request, res: Response) => {
    res.json(await getFunnel(req.params.tag));
  });

  app.get("/api/trend/:tag", auth, async (req: Request, res: Response) => {
    res.json(await getTrend(req.params.tag));
  });

  // Statik dashboard (webapp/index.html)
  app.use(express.static(path.resolve(process.cwd(), "webapp")));

  app.listen(port, () => logger.info(`Web dashboard on :${port}`));
}
