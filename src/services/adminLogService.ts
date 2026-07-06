import { AdminLogModel } from "../models/AdminLog";

export async function logAdminAction(params: {
  adminId: number;
  action: string;
  target?: string;
}): Promise<void> {
  try {
    await AdminLogModel.create({
      admin_id: params.adminId,
      action_type: params.action,
      target: params.target,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to write admin log", error);
  }
}
