export { AIService, createAIProvider, createAIService } from "./ai.service.js";
export type { AIServiceConfig } from "./ai.service.js";
export { GeminiProvider } from "./gemini-provider.js";
export { buildStudyAssistantInstructions } from "./study-assistant-prompt.js";
export { buildQuizInstructions } from "./quiz-prompt.js";
export type { GeminiProviderConfig } from "./gemini-provider.js";
export {
  AIApplicationError,
  AIConfigurationError,
  AIContextTooLargeError,
  AIProviderError,
  AIResponseError,
  normalizeProviderError,
} from "./ai-provider.js";
export type {
  AIProvider,
  AIOperation,
  AIConversationMessage,
  CourseGenerationRequest,
  QuestionAnswerRequest,
  QuizGenerationRequest,
  StructuredGenerationRequest,
} from "./ai-provider.js";
