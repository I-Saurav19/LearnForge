import "dotenv/config";
import { env } from "../config/env.js";
import { AIServiceConfig, createAIProvider } from "../services/ai/ai.service.js";
import { GeminiProvider } from "../services/ai/gemini-provider.js";

async function checkGemini(): Promise<void> {
  const config: AIServiceConfig = {
    provider: env.aiProvider,
    geminiApiKey: env.geminiApiKey,
    geminiModel: env.geminiModel,
    maxContextChars: env.aiMaxContextChars,
    requestTimeoutMs: env.aiRequestTimeoutMs,
    maxHistoryMessages: env.aiMaxHistoryMessages,
  };
  const provider = createAIProvider(config);
  if (!(provider instanceof GeminiProvider)) throw new Error("The manual connectivity check is only available for Gemini.");
  await provider.checkConnection();
  console.info(`Gemini connectivity check succeeded using ${env.geminiModel}.`);
}

checkGemini().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The provider check failed.";
  console.error(`Gemini connectivity check failed: ${message}`);
  process.exitCode = 1;
});
