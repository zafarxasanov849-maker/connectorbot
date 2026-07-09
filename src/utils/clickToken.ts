import crypto from "crypto";
import { env } from "../config/env";

// Klik havolasi uchun imzolangan token: (foydalanuvchi, tag, xabar, tugma).
// Ma'lumot tokenning o'zida (bazaga yozish shart emas), imzo soxtalashtirishni oldini oladi.
export interface ClickPayload {
  u: number; // telegram_id
  t: string; // source_tag
  o: number; // message order
  b: number; // button index
}

function sign(body: string): string {
  return crypto
    .createHmac("sha256", env.botToken)
    .update(body)
    .digest("base64url")
    .slice(0, 16);
}

export function signClickToken(payload: ClickPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyClickToken(token: string): ClickPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sig !== sign(body)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}
