import { describe, expect, it } from "vitest";
import { env, StartupConfigurationError, validateStartupConfiguration } from "./env.js";

const validConfiguration = {
  ...env,
  mongoUri: "mongodb://127.0.0.1:27017/learnforge_test",
  authSecret: "test-only-secret-that-is-at-least-thirty-two-characters",
  geminiApiKey: "test-only-key",
};

describe("startup configuration", () => {
  it("accepts a complete local configuration", () => {
    expect(() => validateStartupConfiguration(validConfiguration)).not.toThrow();
  });

  it("reports a missing database variable by name", () => {
    expect(() => validateStartupConfiguration({ ...validConfiguration, mongoUri: undefined }))
      .toThrow(new StartupConfigurationError("Missing required environment variable: MONGODB_URI"));
  });

  it("requires deployment values explicitly instead of accepting local defaults", () => {
    const providedVariables = {
      PORT: "8080",
      MONGODB_URI: "mongodb://example.invalid/db",
      FRONTEND_URL: "https://learnforge.example",
      AUTH_SECRET: validConfiguration.authSecret,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-only-key",
      GEMINI_MODEL: "gemini-test",
      DOCUMENT_UPLOAD_DIR: "D:/persistent/learnforge-uploads",
    };
    expect(() => validateStartupConfiguration({
      ...validConfiguration,
      mongoUri: "mongodb+srv://cluster.example.invalid/learnforge_ai",
      frontendUrl: "https://learnforge.example",
    }, { production: true, providedVariables })).not.toThrow();
    expect(() => validateStartupConfiguration(validConfiguration, {
      production: true,
      providedVariables: { ...providedVariables, FRONTEND_URL: "" },
    }))
      .toThrow("Missing required environment variable: FRONTEND_URL");
  });

  it("rejects invalid secrets, provider settings, and numeric limits", () => {
    expect(() => validateStartupConfiguration({ ...validConfiguration, authSecret: "short" })).toThrow(/AUTH_SECRET/);
    expect(() => validateStartupConfiguration({ ...validConfiguration, aiProvider: "other" })).toThrow(/Unsupported AI_PROVIDER/);
    expect(() => validateStartupConfiguration({ ...validConfiguration, aiMaxContextChars: 0 })).toThrow(/AI_MAX_CONTEXT_CHARS/);
    expect(() => validateStartupConfiguration({ ...validConfiguration, geminiApiKey: undefined })).toThrow(/GEMINI_API_KEY/);
  });

  it("rejects a local MongoDB URL in production", () => {
    expect(() => validateStartupConfiguration({ ...validConfiguration, mongoUri: "mongodb://127.0.0.1:27017/learnforge_ai" }, {
      production: true,
      providedVariables: {
        PORT: "8080", MONGODB_URI: "mongodb://127.0.0.1:27017/learnforge_ai",
        FRONTEND_URL: "https://learnforge.example", AUTH_SECRET: validConfiguration.authSecret,
        AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-only-key", GEMINI_MODEL: "gemini-test",
        DOCUMENT_UPLOAD_DIR: "D:/persistent/learnforge-uploads",
      },
    })).toThrow("MONGODB_URI must point to a hosted MongoDB service in production.");
  });
});
