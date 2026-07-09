import { Schema, model, Document } from "mongoose";

// Har bir sequence xabaridagi tugma uchun kuzatuv havolasi.
// Tugma botga `t.me/bot?start=<token>` orqali qaytadi, bot bosishni yozib,
// foydalanuvchini `url` ga yo'naltiradi.
export interface IClickLink extends Document {
  token: string;
  source_tag: string;
  order: number;
  button_index: number;
  url: string;
  label?: string;
  created_at: Date;
}

const ClickLinkSchema = new Schema<IClickLink>({
  token: { type: String, required: true, unique: true, index: true },
  source_tag: { type: String, required: true },
  order: { type: Number, required: true },
  button_index: { type: Number, required: true },
  url: { type: String, required: true },
  label: { type: String },
  created_at: { type: Date, default: Date.now },
});

// Har bir tugma pozitsiyasi uchun bitta havola.
ClickLinkSchema.index(
  { source_tag: 1, order: 1, button_index: 1 },
  { unique: true }
);

export const ClickLinkModel = model<IClickLink>("ClickLink", ClickLinkSchema);
