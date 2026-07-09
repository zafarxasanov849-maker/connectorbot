import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getUserByTelegramId, setAmoLeadId } from "./userService";

// AmoCRM sozlangan-sozlanmaganini tekshiradi (env orqali).
export function isAmoCrmConfigured(): boolean {
  return Boolean(env.amoCrm.subdomain && env.amoCrm.token);
}

function baseUrl(): string {
  return `https://${env.amoCrm.subdomain}/api/v4`;
}

async function amoFetch(
  path: string,
  init: Parameters<typeof fetch>[1] = {}
): Promise<any> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.amoCrm.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AmoCRM ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

async function addNote(leadId: number, text: string): Promise<void> {
  await amoFetch(`/leads/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify([{ note_type: "common", params: { text } }]),
  });
}

// Oddiy foydalanuvchi xabarini AmoCRM'ga yuboradi.
// Foydalanuvchi uchun bitta lead saqlanadi: birinchi xabarda lead+kontakt
// yaratiladi, keyingilari o'sha lead'ga eslatma (note) sifatida qo'shiladi.
export async function forwardToAmoCrm(params: {
  telegramId: number;
  username?: string;
  text: string;
}): Promise<void> {
  if (!isAmoCrmConfigured()) return;

  const contactName = params.username
    ? `@${params.username}`
    : `tg-${params.telegramId}`;
  const noteText = `Telegram ${contactName} (id ${params.telegramId})\n\n${params.text}`;

  const user = await getUserByTelegramId(params.telegramId);

  // Mavjud lead bo'lsa — faqat eslatma qo'shamiz.
  if (user?.amo_lead_id) {
    await addNote(user.amo_lead_id, noteText);
    return;
  }

  // Yangi lead + kontakt yaratamiz.
  const payload = [
    {
      name: `Telegram: ${contactName}`,
      ...(env.amoCrm.pipelineId ? { pipeline_id: env.amoCrm.pipelineId } : {}),
      _embedded: { contacts: [{ name: contactName }] },
    },
  ];
  const created = await amoFetch(`/leads/complex`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const leadId: number | undefined = created?.[0]?.id;
  if (!leadId) {
    logger.error("AmoCRM lead yaratildi, lekin id qaytmadi", created);
    return;
  }
  await setAmoLeadId(params.telegramId, leadId).catch((e) =>
    logger.error("setAmoLeadId xatosi", e)
  );
  await addNote(leadId, noteText).catch((e) =>
    logger.error("AmoCRM eslatma qo'shishda xato", e)
  );
}
