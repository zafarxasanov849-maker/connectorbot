import crypto from "crypto";
import { env } from "../config/env";

// Klik havolasi uchun imzolangan token. Ma'lumot tokenning o'zida, imzo
// soxtalashtirishni oldini oladi. Ikki tur: sequence (s) va broadcast (b).
export type ClickPayload =
  | { k?: "s"; u: number; t: string; o: number; b: number } // sequence
  | { k: "b"; u: number; id: string; b: number }; // broadcast

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
