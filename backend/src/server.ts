import app from "./app.js";
import { connectToDatabase } from "./config/database.js";
import mongoose from "mongoose";
import { env, validateStartupConfiguration } from "./config/env.js";
import { createAIService } from "./services/ai/index.js";
import type { Server } from "node:http";

async function startServer(): Promise<void> {
  validateStartupConfiguration();
  app.locals.aiService = createAIService();
  try {
    await connectToDatabase();
  } catch {
    throw new Error("Unable to connect to MongoDB. Check MONGODB_URI and confirm the database is available.");
  }
  const server: Server = await new Promise((resolve, reject) => {
    const listener = app.listen(env.port, () => resolve(listener));
    listener.once("error", reject);
  });
  console.info(`LearnForge AI API listening on port ${env.port}`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; shutting down LearnForge AI API.`);
    void (async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await mongoose.disconnect();
    })().catch(() => console.error("Unable to shut down the API and MongoDB connection cleanly."));
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected startup error.";
  console.error(`Unable to start LearnForge AI API: ${message}`);
  process.exitCode = 1;
});
