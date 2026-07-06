import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  telegram_id: number;
  username?: string;
  source_tag?: string;
  join_date: Date;
  is_active: boolean;
}

const UserSchema = new Schema<IUser>({
  telegram_id: { type: Number, unique: true, index: true, required: true },
  username: { type: String },
  source_tag: { type: String, index: true },
  join_date: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
});

export const UserModel = model<IUser>("User", UserSchema);
