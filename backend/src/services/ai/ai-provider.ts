import type { ZodType } from "zod";

export interface StructuredGenerationRequest<T> {
  materialText: string;
  outputSchema: ZodType<T>;
}

export interface CourseGenerationRequest<T> extends StructuredGenerationRequest<T> {
  instructions: string;
}

export interface QuestionAnswerRequest {
  instructions: string;
  materialText: string;
  courseContext: {
    title: string;
    description: string;
    topicTitles: string[];
  };
  question: string;
  history: AIConversationMessage[];
}

export interface AIConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QuizGenerationRequest<T> extends StructuredGenerationRequest<T> {
  instructions?: string;
  courseContext?: {
    title: string;
    description: string;
    topicTitles: string[];
  };
  questionCount?: number;
}

/** Application operations supported by any configured AI provider. */
export interface AIProvider {
  generateCourse<T>(request: CourseGenerationRequest<T>): Promise<unknown>;
  answerQuestion(request: QuestionAnswerRequest): Promise<string>;
  generateQuiz<T>(request: QuizGenerationRequest<T>): Promise<unknown>;
}

export type AIOperation = "course generation" | "question answering" | "quiz generation" | "connectivity check";

export class AIApplicationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "AIApplicationError";
  }
}

export class AIConfigurationError extends AIApplicationError {
  constructor(message: string) {
    super(message, "AI_CONFIGURATION_ERROR");
    this.name = "AIConfigurationError";
  }
}

export class AIContextTooLargeError extends AIApplicationError {
  constructor(readonly maximumCharacters: number) {
    super(`The AI input is too large. Reduce the material to ${maximumCharacters} characters or less.`, "AI_CONTEXT_TOO_LARGE");
    this.name = "AIContextTooLargeError";
  }
}

export class AIProviderError extends AIApplicationError {
  constructor(message: string, code = "AI_PROVIDER_ERROR") {
    super(message, code);
    this.name = "AIProviderError";
  }
}

export class AIResponseError extends AIApplicationError {
  constructor(message = "The AI provider returned an invalid response.") {
    super(message, "AI_INVALID_RESPONSE");
    this.name = "AIResponseError";
  }
}

export function normalizeProviderError(error: unknown, operation: AIOperation): AIApplicationError {
  if (error instanceof AIApplicationError) return error;
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown; name?: unknown; message?: unknown };
  const status = Number(candidate?.status ?? candidate?.statusCode);
  const code = typeof candidate?.code === "string" ? candidate.code.toUpperCase() : "";
  const name = typeof candidate?.name === "string" ? candidate.name.toLowerCase() : "";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";

  if (status === 429) return new AIProviderError("The AI provider is receiving too many requests. Try again shortly.", "AI_RATE_LIMITED");
  if (name.includes("outputparser") || name.includes("syntaxerror") || name.includes("zod") || name.includes("responseerror")) {
    return new AIResponseError();
  }
  if (name.includes("abort") || code.includes("TIMEOUT") || code === "ETIMEDOUT" || message.includes("timeout")) {
    return new AIProviderError("The AI provider request timed out. Try again.", "AI_TIMEOUT");
  }
  if (["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(code) || /fetch failed|network error|econnreset|econnrefused|enotfound|eai_again/.test(message)) {
    return new AIProviderError("The AI provider could not be reached. Try again shortly.", "AI_NETWORK_ERROR");
  }
  return new AIProviderError(`The AI provider could not complete ${operation}. Try again later.`);
}
