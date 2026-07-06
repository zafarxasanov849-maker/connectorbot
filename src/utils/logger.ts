import { env } from "../config/env";

type Level = "debug" | "info" | "warn" | "error";

const levelPriority: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: Level): boolean {
  const current = (env.logLevel as Level) || "info";
  return levelPriority[level] >= (levelPriority[current] ?? 20);
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog("debug") && console.debug(...args),
  info: (...args: unknown[]) => shouldLog("info") && console.info(...args),
  warn: (...args: unknown[]) => shouldLog("warn") && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
