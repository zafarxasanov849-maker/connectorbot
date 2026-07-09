import crypto from "crypto";

// Telegram Mini App'dan kelgan initData ni bot tokeni bilan tekshiradi.
// Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function validateInitData(
  initData: string,
  botToken: string
): { ok: boolean; userId?: number } {
  if (!initData) return { ok: false };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computed !== hash) return { ok: false };

  let userId: number | undefined;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      userId = JSON.parse(userRaw).id;
    } catch {
      // e'tiborsiz
    }
  }
  return { ok: true, userId };
}
