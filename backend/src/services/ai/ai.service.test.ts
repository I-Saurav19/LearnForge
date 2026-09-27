import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AIService, createAIProvider, createAIService, type AIServiceConfig } from "./ai.service.js";
import { AIConfigurationError, AIContextTooLargeError, AIProviderError, AIResponseError, type AIProvider } from "./ai-provider.js";
import { GeminiProvider } from "./gemini-provider.js";

const schema = z.object({ title: z.string(), lessons: z.array(z.string()) });

class FakeAIProvider implements AIProvider {
  courseOutput: unknown = { title: "Cells", lessons: ["Cell structure"] };
  quizOutput: unknown = { title: "Cells quiz", lessons: ["Question 1"] };
  answer = "Cells are the basic unit of life.";
  generateCourse = vi.fn(async () => this.courseOutput);
  answerQuestion = vi.fn(async () => this.answer);
  generateQuiz = vi.fn(async () => this.quizOutput);
}

const baseConfig: AIServiceConfig = {
  provider: "gemini",
  geminiApiKey: "test-key-not-a-real-secret",
  geminiModel: "gemini-test-model",
  maxContextChars: 100,
  requestTimeoutMs: 1_000,
  maxHistoryMessages: 12,
};

const questionRequest = {
  instructions: "Answer from the material.",
  materialText: "cells",
  courseContext: { title: "Biology", description: "Cells", topicTitles: ["Cell structure"] },
  question: "What is a cell?",
  history: [],
};

describe("AI provider foundation", () => {
  it("supports replaceable provider operations through AIService", async () => {
    const provider = new FakeAIProvider();
    const service = new AIService(provider, 100);
    await expect(service.generateCourse({ materialText: "cells", outputSchema: schema })).resolves.toEqual(provider.courseOutput);
    await expect(service.answerQuestion(questionRequest)).resolves.toBe(provider.answer);
    await expect(service.generateQuiz({ materialText: "cells", outputSchema: schema, questionCount: 1 })).resolves.toEqual(provider.quizOutput);
    expect(provider.generateCourse).toHaveBeenCalledOnce();
    expect(provider.answerQuestion).toHaveBeenCalledOnce();
    expect(provider.generateQuiz).toHaveBeenCalledOnce();
  });

  it("requires Gemini credentials when initializing the configured provider", () => {
    expect(() => createAIProvider({ ...baseConfig, geminiApiKey: " " })).toThrow(AIConfigurationError);
    expect(() => new GeminiProvider({ apiKey: "", model: "gemini-test", timeoutMs: 1_000 })).toThrow(/GEMINI_API_KEY/);
  });

  it("rejects unsupported providers and invalid limits clearly", () => {
    expect(() => createAIProvider({ ...baseConfig, provider: "grok" })).toThrow(/Unsupported AI_PROVIDER/);
    expect(() => createAIProvider({ ...baseConfig, maxContextChars: 0 })).toThrow(/AI_MAX_CONTEXT_CHARS/);
    expect(() => createAIService({ ...baseConfig, requestTimeoutMs: -1 })).toThrow(/AI_REQUEST_TIMEOUT_MS/);
  });

  it("initializes Gemini as the configured provider without making an API request", () => {
    expect(createAIProvider(baseConfig)).toBeInstanceOf(GeminiProvider);
  });

  it("normalizes provider errors without returning provider details", async () => {
    const provider = new FakeAIProvider();
    provider.answerQuestion.mockRejectedValueOnce(Object.assign(new Error("private provider response"), { status: 429 }));
    const service = new AIService(provider, 100);
    await expect(service.answerQuestion({ ...questionRequest, materialText: "notes", question: "question" })).rejects.toMatchObject({
      name: "AIProviderError",
      code: "AI_RATE_LIMITED",
      message: "The AI provider is receiving too many requests. Try again shortly.",
    });
  });

  it("classifies timeout and network errors", async () => {
    const provider = new FakeAIProvider();
    provider.answerQuestion.mockRejectedValueOnce(Object.assign(new Error("socket timeout"), { code: "ETIMEDOUT" }));
    await expect(new AIService(provider).answerQuestion({ ...questionRequest, materialText: "x", question: "y" })).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    provider.answerQuestion.mockRejectedValueOnce(Object.assign(new Error("network failure"), { code: "ECONNRESET" }));
    await expect(new AIService(provider).answerQuestion({ ...questionRequest, materialText: "x", question: "y" })).rejects.toMatchObject({ code: "AI_NETWORK_ERROR" });
  });

  it("validates structured responses at the AI service boundary", async () => {
    const provider = new FakeAIProvider();
    provider.courseOutput = { title: 42, lessons: [] };
    await expect(new AIService(provider).generateCourse({ materialText: "notes", outputSchema: schema })).rejects.toBeInstanceOf(AIResponseError);
  });

  it("rejects contexts above the configured limit without truncating them", async () => {
    const provider = new FakeAIProvider();
    const service = new AIService(provider, 5);
    await expect(service.generateCourse({ materialText: "123456", outputSchema: schema })).rejects.toBeInstanceOf(AIContextTooLargeError);
    await expect(service.answerQuestion({ ...questionRequest, materialText: "1234", question: "56" })).rejects.toBeInstanceOf(AIContextTooLargeError);
    expect(provider.generateCourse).not.toHaveBeenCalled();
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects empty answers returned by a mock provider", async () => {
    const provider = new FakeAIProvider();
    provider.answer = "  ";
    await expect(new AIService(provider).answerQuestion({ ...questionRequest, materialText: "notes", question: "why?" })).rejects.toBeInstanceOf(AIResponseError);
  });

  it("preserves safe application errors instead of leaking raw errors", async () => {
    const provider = new FakeAIProvider();
    provider.generateQuiz.mockRejectedValueOnce(new Error("raw response containing secrets"));
    await expect(new AIService(provider).generateQuiz({ materialText: "notes", outputSchema: schema })).rejects.toMatchObject({
      message: "The AI provider could not complete quiz generation. Try again later.",
    });
    await expect(new AIService(provider).generateCourse({ materialText: "notes", outputSchema: schema })).resolves.toBeDefined();
  });
});
