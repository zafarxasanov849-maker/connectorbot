import { UserModel, IUser } from "../models/User";

export async function findOrCreateUser(
  telegramId: number,
  username?: string,
  sourceTag?: string
): Promise<{ user: IUser; isNew: boolean }> {
  const existing = await UserModel.findOne({ telegram_id: telegramId });
  if (existing) {
    return { user: existing, isNew: false };
  }

  const user = new UserModel({
    telegram_id: telegramId,
    username,
    source_tag: sourceTag,
    join_date: new Date(),
    is_active: true,
  });
  const saved = await user.save();
  return { user: saved, isNew: true };
}

export async function getUserCountBySource(): Promise<
  { source_tag: string; count: number }[]
> {
  const aggregation = await UserModel.aggregate([
    {
      $group: {
        _id: "$source_tag",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        source_tag: { $ifNull: ["$_id", "unknown"] },
        count: 1,
      },
    },
  ]);

  return aggregation;
}

export async function getAllUserIds(filter?: {
  source_tag?: string;
}): Promise<number[]> {
  const query = filter?.source_tag
    ? { source_tag: filter.source_tag }
    : {};
  const users = await UserModel.find(query, { telegram_id: 1 }).lean();
  return users.map((u) => u.telegram_id);
}

export async function getAllUsers(): Promise<IUser[]> {
  return UserModel.find().lean();
}

export async function getUserByTelegramId(
  telegramId: number
): Promise<IUser | null> {
  return UserModel.findOne({ telegram_id: telegramId });
}

export async function setAmoLeadId(
  telegramId: number,
  amoLeadId: number
): Promise<void> {
  await UserModel.updateOne(
    { telegram_id: telegramId },
    { amo_lead_id: amoLeadId }
  );
}

// Bot bloklangan/yetib bo'lmaydigan foydalanuvchini nofaol qilamiz.
export async function deactivateUser(telegramId: number): Promise<void> {
  await UserModel.updateOne(
    { telegram_id: telegramId },
    { is_active: false }
  );
}
