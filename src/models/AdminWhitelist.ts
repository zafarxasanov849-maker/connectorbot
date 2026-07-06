import { Schema, model, Document } from "mongoose";

export interface IAdminWhitelist extends Document {
  admin_id: number;
  note?: string;
}

const AdminWhitelistSchema = new Schema<IAdminWhitelist>({
  admin_id: { type: Number, unique: true, index: true, required: true },
  note: { type: String },
});

export const AdminWhitelistModel = model<IAdminWhitelist>(
  "AdminWhitelist",
  AdminWhitelistSchema
);
