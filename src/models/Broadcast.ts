import { Schema, model, Document } from "mongoose";

// Har bir yuborilgan reklama kampaniyasi va uning natijalari.
export interface IBroadcast extends Document {
  admin_id: number;
  target: string; // "all" yoki "source:<tag>"
  text_preview: string;
  buttons: { label: string; url: string }[];
  total: number;
  delivered: number;
  failed: number;
  clickers: number[]; // tugma bosgan unikal telegram_id'lar
  created_at: Date;
}

const BroadcastSchema = new Schema<IBroadcast>({
  admin_id: { type: Number, required: true },
  target: { type: String, required: true },
  text_preview: { type: String, default: "" },
  buttons: {
    type: [new Schema({ label: String, url: String }, { _id: false })],
    default: [],
  },
  total: { type: Number, default: 0 },
  delivered: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  clickers: { type: [Number], default: [] },
  created_at: { type: Date, default: Date.now },
});

export const BroadcastModel = model<IBroadcast>("Broadcast", BroadcastSchema);
