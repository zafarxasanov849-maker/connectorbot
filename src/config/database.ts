import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);
    return await mongoose.connect(env.mongoUri);
  } catch (error) {
    console.error("Mongo connection error:", error);
    throw error;
  }
}
