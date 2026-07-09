import { Schema, model, Document } from "mongoose";

export type SequenceEventType = "started" | "delivered" | "clicked";

export interface ISequenceEvent extends Document {
  source_tag: string;
  telegram_id: number;
  order?: number;
  button_index?: number;
  type: SequenceEventType;
  created_at: Date;
}

const SequenceEventSchema = new Schema<ISequenceEvent>({
  source_tag: { type: String, index: true, required: true },
  telegram_id: { type: Number, required: true },
  order: { type: Number },
  button_index: { type: Number },
  type: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

// Funnel agregatsiyalari uchun tezkor indeks.
SequenceEventSchema.index({ source_tag: 1, type: 1, order: 1 });

export const SequenceEventModel = model<ISequenceEvent>(
  "SequenceEvent",
  SequenceEventSchema
);
