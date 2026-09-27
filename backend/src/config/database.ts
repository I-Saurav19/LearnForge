import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectToDatabase(): Promise<void> {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured. Add it to backend/.env.");
  }

  await mongoose.connect(env.mongoUri);
  console.info("Connected to MongoDB");
}
