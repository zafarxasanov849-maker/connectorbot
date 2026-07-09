import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);
    return await mongoose.connect(env.mongoUri);
  } catch (error) {
    logger.error("Mongo ulanish xatosi:", error);
    throw error;
  }
}
