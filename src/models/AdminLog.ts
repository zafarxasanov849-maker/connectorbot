import { Schema, model, Document } from "mongoose";

export interface IAdminLog extends Document {
  admin_id: number;
  action_type: string;
  target?: string;
  timestamp: Date;
}

const AdminLogSchema = new Schema<IAdminLog>({
  admin_id: { type: Number, required: true },
  action_type: { type: String, required: true },
  target: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export const AdminLogModel = model<IAdminLog>("AdminLog", AdminLogSchema);
