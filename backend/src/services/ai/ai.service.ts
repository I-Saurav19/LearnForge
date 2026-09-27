import type { ZodType } from "zod";
import { env } from "../../config/env.js";
import { AIContextTooLargeError, AIConfigurationError, AIProviderError, AIResponseError, normalizeProviderError, type AIConversationMessage, type AIProvider, type CourseGenerationRequest, type QuestionAnswerRequest, type QuizGenerationRequest } from "./ai-provider.js";
import { GeminiProvider } from "./gemini-provider.js";

export interface AIServiceConfig {
  provider: string;
  geminiApiKey?: string;
  geminiModel: string;
  maxContextChars: number;
  requestTimeoutMs: number;
  maxHistoryMessages: number;
}

export function createAIProvider(config: AIServiceConfig): AIProvider {
  if (!Number.isSafeInteger(config.maxContextChars) || config.maxContextChars < 1) {
    throw new AIConfigurationError("AI_MAX_CONTEXT_CHARS must be a positive integer.");
  }
  switch (config.provider.trim().toLowerCase()) {
    case "gemini":
      return new GeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel, timeoutMs: config.requestTimeoutMs });
    default:
      throw new AIConfigurationError(`Unsupported AI_PROVIDER: ${config.provider}. Supported provider: gemini.`);
  }
}

export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly maxContextChars = env.aiMaxContextChars,
    private readonly maxHistoryMessages = env.aiMaxHistoryMessages,
  ) {
    if (!Number.isSafeInteger(maxContextChars) || maxContextChars < 1) {
      throw new AIConfigurationError("AI_MAX_CONTEXT_CHARS must be a positive integer.");
    }
    if (!Number.isSafeInteger(maxHistoryMessages) || maxHistoryMessages < 0 || maxHistoryMessages > 24) {
      throw new AIConfigurationError("AI_MAX_HISTORY_MESSAGES must be an integer between 0 and 24.");
    }
  }

  async generateCourse<T>(request: CourseGenerationRequest<T>): Promise<T> {
    this.assertContextSize(request.materialText.length);
    try {
      return this.validateOutput(request.outputSchema, await this.provider.generateCourse(request));
    } catch (error) {
      throw normalizeProviderError(error, "course generation");
    }
  }

  async answerQuestion(request: QuestionAnswerRequest): Promise<string> {
    const history: AIConversationMessage[] = this.maxHistoryMessages === 0 ? [] : request.history.slice(-this.maxHistoryMessages);
    const contextSize = request.materialText.length
      + request.question.length
      + request.instructions.length
      + request.courseContext.title.length
      + request.courseContext.description.length
      + request.courseContext.topicTitles.reduce((total, title) => total + title.length, 0)
      + history.reduce((total, message) => total + message.content.length, 0);
    this.assertContextSize(contextSize);
    try {
      const answer = await this.provider.answerQuestion({ ...request, history });
      if (typeof answer !== "string" || !answer.trim()) throw new AIResponseError();
      return answer;
    } catch (error) {
      throw normalizeProviderError(error, "question answering");
    }
  }

  async generateQuiz<T>(request: QuizGenerationRequest<T>): Promise<T> {
    const contextSize = request.materialText.length
      + (request.instructions?.length ?? 0)
      + (request.courseContext?.title.length ?? 0)
      + (request.courseContext?.description.length ?? 0)
      + (request.courseContext?.topicTitles.reduce((total, title) => total + title.length, 0) ?? 0);
    this.assertContextSize(contextSize);
    try {
      return this.validateOutput(request.outputSchema, await this.provider.generateQuiz(request));
    } catch (error) {
      throw normalizeProviderError(error, "quiz generation");
    }
  }

  private assertContextSize(characterCount: number): void {
    if (!Number.isSafeInteger(this.maxContextChars) || this.maxContextChars < 1) {
      throw new AIConfigurationError("AI_MAX_CONTEXT_CHARS must be a positive integer.");
    }
    if (characterCount > this.maxContextChars) throw new AIContextTooLargeError(this.maxContextChars);
  }

  private validateOutput<T>(schema: ZodType<T>, output: unknown): T {
    const result = schema.safeParse(output);
    if (!result.success) throw new AIResponseError("The AI provider response did not match the expected structure.");
    return result.data;
  }
}

export function createAIService(config: AIServiceConfig = {
  provider: env.aiProvider,
  geminiApiKey: env.geminiApiKey,
  geminiModel: env.geminiModel,
  maxContextChars: env.aiMaxContextChars,
  requestTimeoutMs: env.aiRequestTimeoutMs,
  maxHistoryMessages: env.aiMaxHistoryMessages,
}): AIService {
  return new AIService(createAIProvider(config), config.maxContextChars, config.maxHistoryMessages);
}
