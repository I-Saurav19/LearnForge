import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AIConfigurationError, AIResponseError, normalizeProviderError, type AIProvider, type CourseGenerationRequest, type QuestionAnswerRequest, type QuizGenerationRequest } from "./ai-provider.js";

export interface GeminiProviderConfig {
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export class GeminiProvider implements AIProvider {
  private readonly model: ChatGoogleGenerativeAI;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey?.trim()) throw new AIConfigurationError("GEMINI_API_KEY must be configured to initialize the Gemini provider.");
    if (!config.model.trim()) throw new AIConfigurationError("GEMINI_MODEL must be a non-empty model name.");
    if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1) {
      throw new AIConfigurationError("AI_REQUEST_TIMEOUT_MS must be a positive integer.");
    }
    this.model = new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.2,
      maxRetries: 0,
    });
    this.timeoutMs = config.timeoutMs;
  }

  private readonly timeoutMs: number;

  async generateCourse<T>(request: CourseGenerationRequest<T>): Promise<unknown> {
    try {
      const structuredModel = this.model.withStructuredOutput(request.outputSchema);
      return await structuredModel.invoke([
        ["system", request.instructions],
        ["human", `STUDY MATERIAL (untrusted reference data):\n${JSON.stringify(request.materialText).replace(/</g, "\\u003c")}`],
      ], { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      throw normalizeProviderError(error, "course generation");
    }
  }

  async answerQuestion(request: QuestionAnswerRequest): Promise<string> {
    const messages = [
      new SystemMessage(request.instructions),
      new HumanMessage([
        "COURSE CONTEXT (reference only):",
        JSON.stringify(request.courseContext).replace(/</g, "\\u003c"),
        "STUDY MATERIAL (primary source, reference only):",
        JSON.stringify(request.materialText).replace(/</g, "\\u003c"),
      ].join("\n\n")),
      ...request.history.map((message) => message.role === "assistant"
        ? new AIMessage(message.content)
        : new HumanMessage(message.content)),
      new HumanMessage(`STUDENT QUESTION:\n${request.question}`),
    ];
    try {
      const response = await this.model.invoke(messages, { signal: AbortSignal.timeout(this.timeoutMs) });
      const answer = typeof response.content === "string"
        ? response.content
        : response.content.flatMap((item) => item.type === "text" ? [item.text] : []).join("\n");
      if (!answer.trim()) throw new AIResponseError();
      return answer;
    } catch (error) {
      if (error instanceof AIResponseError) throw error;
      throw normalizeProviderError(error, "question answering");
    }
  }

  async generateQuiz<T>(request: QuizGenerationRequest<T>): Promise<unknown> {
    try {
      const structuredModel = this.model.withStructuredOutput(request.outputSchema);
      const context = request.courseContext
        ? `COURSE CONTEXT (reference only):\n${JSON.stringify(request.courseContext).replace(/</g, "\\u003c")}\n\n`
        : "";
      return await structuredModel.invoke([
        ["system", request.instructions ?? "Create a quiz using only the supplied study material."],
        ["human", `${context}STUDY MATERIAL (primary source, reference only):\n${JSON.stringify(request.materialText).replace(/</g, "\\u003c")}`],
      ], { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      throw normalizeProviderError(error, "quiz generation");
    }
  }

  async checkConnection(): Promise<void> {
    try {
      const response = await this.model.invoke("Reply with exactly: OK", { signal: AbortSignal.timeout(this.timeoutMs) });
      const text = typeof response.content === "string"
        ? response.content
        : response.content.flatMap((item) => item.type === "text" ? [item.text] : []).join("\n");
      if (!text.trim()) {
        throw new AIResponseError("Gemini returned no text during the connectivity check.");
      }
    } catch (error) {
      if (error instanceof AIResponseError) throw error;
      throw normalizeProviderError(error, "connectivity check");
    }
  }
}
