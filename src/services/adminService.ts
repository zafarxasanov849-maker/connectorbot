import { AdminWhitelistModel } from "../models/AdminWhitelist";

export async function isAdmin(telegramId: number): Promise<boolean> {
  const admin = await AdminWhitelistModel.findOne({ admin_id: telegramId });
  return Boolean(admin);
}

export async function seedAdmins(adminIds: number[]): Promise<void> {
  if (!adminIds.length) return;
  const bulk = adminIds.map((id) => ({
    updateOne: {
      filter: { admin_id: id },
      update: { admin_id: id },
      upsert: true,
    },
  }));
  await AdminWhitelistModel.bulkWrite(bulk);
}
