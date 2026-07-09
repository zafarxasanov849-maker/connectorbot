import crypto from "crypto";
import { ClickLinkModel, IClickLink } from "../models/ClickLink";

function generateToken(): string {
  // "k_" prefiksi klik havolasini oddiy source tag'dan ajratadi.
  return "k_" + crypto.randomBytes(6).toString("base64url");
}

// Tugma pozitsiyasi (tag, order, button_index) uchun barqaror token beradi.
// Mavjud bo'lsa — o'shani qaytaradi (url/label yangilanadi), aks holda yaratadi.
export async function getOrCreateClickToken(params: {
  sourceTag: string;
  order: number;
  buttonIndex: number;
  url: string;
  label?: string;
}): Promise<string> {
  const doc = await ClickLinkModel.findOneAndUpdate(
    {
      source_tag: params.sourceTag,
      order: params.order,
      button_index: params.buttonIndex,
    },
    {
      $set: { url: params.url, label: params.label },
      $setOnInsert: { token: generateToken(), created_at: new Date() },
    },
    { new: true, upsert: true }
  );
  return doc.token;
}

export async function resolveClickToken(
  token: string
): Promise<IClickLink | null> {
  return ClickLinkModel.findOne({ token }).lean();
}
