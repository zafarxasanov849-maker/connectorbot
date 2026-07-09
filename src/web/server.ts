import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { env } from "../config/env";
import { validateInitData } from "./auth";
import { isAdmin } from "../services/adminService";
import { listContentTags, getPackageWithMessages } from "../services/contentService";
import { getFunnel } from "../services/analyticsService";
import { logger } from "../utils/logger";

// Funnel dashboard (Telegram Mini App) uchun web-server.
export function startWebServer(): void {
  const port = Number(process.env.WEB_PORT) || 3000;
  const app = express();
  app.use(express.json());

  // Faqat admin Mini App'dan kirganlar API'ga ruxsat oladi.
  const auth = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
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

  app.get("/api/funnel/:tag", auth, async (req: Request, res: Response) => {
    const tag = req.params.tag;
    const pkg = await getPackageWithMessages(tag);
    const report = await getFunnel(tag);
    res.json({
      ...report,
      messageCount: pkg?.messages?.length ?? report.steps.length,
    });
  });

  // Statik dashboard (webapp/index.html)
  app.use(express.static(path.resolve(process.cwd(), "webapp")));

  app.listen(port, () => logger.info(`Web dashboard on :${port}`));
}
