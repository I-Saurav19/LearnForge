import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  mongoUri: process.env.MONGODB_URI,
  authSecret: process.env.AUTH_SECRET,
  authCookieName: process.env.AUTH_COOKIE_NAME ?? "learnforge_session",
  authCookieSecure: process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  authTokenTtl: process.env.AUTH_TOKEN_TTL ?? "7d",
  documentUploadDirectory: process.env.DOCUMENT_UPLOAD_DIR ?? "uploads",
  aiProvider: process.env.AI_PROVIDER ?? "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  aiMaxContextChars: Number(process.env.AI_MAX_CONTEXT_CHARS ?? 100_000),
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30_000),
  aiMaxHistoryMessages: Number(process.env.AI_MAX_HISTORY_MESSAGES ?? 12),
};

export class StartupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupConfigurationError";
  }
}

/** Fail before opening connections or listening when deployment configuration is incomplete. */
export function validateStartupConfiguration(
  configuration: typeof env = env,
  options: { production?: boolean; providedVariables?: NodeJS.ProcessEnv } = {},
): void {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const providedVariables = options.providedVariables ?? process.env;
  if (production) {
    for (const name of ["PORT", "MONGODB_URI", "FRONTEND_URL", "AUTH_SECRET", "AI_PROVIDER", "GEMINI_API_KEY", "GEMINI_MODEL", "DOCUMENT_UPLOAD_DIR"] as const) {
      if (!providedVariables[name]?.trim()) {
        throw new StartupConfigurationError(`Missing required environment variable: ${name}`);
      }
    }
  }
  if (!configuration.mongoUri?.trim()) {
    throw new StartupConfigurationError("Missing required environment variable: MONGODB_URI");
  }
  if (production) {
    let mongo: URL;
    try {
      mongo = new URL(configuration.mongoUri);
    } catch {
      throw new StartupConfigurationError("MONGODB_URI must be a valid MongoDB connection string.");
    }
    if (!["mongodb:", "mongodb+srv:"].includes(mongo.protocol) || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(mongo.hostname)) {
      throw new StartupConfigurationError("MONGODB_URI must point to a hosted MongoDB service in production.");
    }
  }
  if (!configuration.authSecret || configuration.authSecret.length < 32) {
    throw new StartupConfigurationError("AUTH_SECRET must be set to a random value with at least 32 characters.");
  }
  if (!Number.isInteger(configuration.port) || configuration.port < 1 || configuration.port > 65_535) {
    throw new StartupConfigurationError("PORT must be a valid port number between 1 and 65535.");
  }
  let frontend: URL;
  try {
    frontend = new URL(configuration.frontendUrl);
  } catch {
    throw new StartupConfigurationError("FRONTEND_URL must be a valid HTTP or HTTPS origin.");
  }
  if (!frontend.origin || frontend.origin !== configuration.frontendUrl || !["http:", "https:"].includes(frontend.protocol)) {
    throw new StartupConfigurationError("FRONTEND_URL must be a valid HTTP or HTTPS origin without a path.");
  }
  if (production && frontend.protocol !== "https:") {
    throw new StartupConfigurationError("FRONTEND_URL must use HTTPS in production.");
  }
  if (configuration.aiProvider !== "gemini") {
    throw new StartupConfigurationError("Unsupported AI_PROVIDER. The configured application supports: gemini.");
  }
  if (!configuration.geminiApiKey?.trim()) {
    throw new StartupConfigurationError("Missing required environment variable: GEMINI_API_KEY (required when AI_PROVIDER=gemini)");
  }
  if (!configuration.geminiModel.trim()) {
    throw new StartupConfigurationError("GEMINI_MODEL must not be empty.");
  }
  if (!Number.isSafeInteger(configuration.aiMaxContextChars) || configuration.aiMaxContextChars < 1) {
    throw new StartupConfigurationError("AI_MAX_CONTEXT_CHARS must be a positive integer.");
  }
  if (!Number.isSafeInteger(configuration.aiRequestTimeoutMs) || configuration.aiRequestTimeoutMs < 1) {
    throw new StartupConfigurationError("AI_REQUEST_TIMEOUT_MS must be a positive integer.");
  }
  if (!Number.isSafeInteger(configuration.aiMaxHistoryMessages) || configuration.aiMaxHistoryMessages < 0) {
    throw new StartupConfigurationError("AI_MAX_HISTORY_MESSAGES must be a non-negative integer.");
  }
}
