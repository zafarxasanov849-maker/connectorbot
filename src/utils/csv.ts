import { stringify } from "csv-stringify/sync";
import { IUser } from "../models/User";

export function usersToCsv(users: IUser[]): string {
  return stringify(
    users.map((u) => ({
      telegram_id: u.telegram_id,
      username: u.username ?? "",
      source_tag: u.source_tag ?? "",
      join_date: u.join_date.toISOString(),
      is_active: u.is_active,
    })),
    { header: true }
  );
}
