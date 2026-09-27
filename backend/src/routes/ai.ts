import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AIContextTooLargeError, AIProviderError, AIResponseError, AIService } from "../services/ai/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { StudyAssistantError, StudyAssistantService } from "../services/study-assistant/study-assistant.service.js";

const aiRouter = Router();
const maximumQuestionCharacters = 4_000;
const maximumHistoryMessages = 24;
const maximumHistoryMessageCharacters = 2_000;
const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(maximumHistoryMessageCharacters),
}).strict();

aiRouter.use(requireAuth);

function validId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function requestStudyAssistant(request: Request): StudyAssistantService | null {
  const aiService = request.app.locals.aiService as AIService | undefined;
  return aiService ? new StudyAssistantService(aiService) : null;
}

function sendAskError(response: Response, error: unknown): void {
  if (error instanceof StudyAssistantError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof AIContextTooLargeError) {
    response.status(413).json({ message: "This study material and conversation are too large to process together. Start a new conversation or use a shorter source document." });
    return;
  }
  if (error instanceof AIResponseError) {
    response.status(502).json({ message: "The study assistant could not produce a usable answer. Please try again." });
    return;
  }
  if (error instanceof AIProviderError) {
    const rateLimited = error.code === "AI_RATE_LIMITED";
    response.status(rateLimited ? 503 : 502).json({
      message: rateLimited
        ? "The study assistant is receiving too many requests. Please try again shortly."
        : "The study assistant is temporarily unavailable. Please try again.",
    });
    return;
  }
  response.status(500).json({ message: "Unable to answer your question right now." });
}

aiRouter.post("/ask", async (request: Request, response: Response) => {
  const body = request.body as { courseId?: unknown; question?: unknown; history?: unknown } | null;
  if (typeof body?.courseId !== "string" || !body.courseId) {
    response.status(400).json({ message: "A courseId is required." });
    return;
  }
  if (!validId(body.courseId)) {
    response.status(400).json({ message: "The course ID is invalid." });
    return;
  }
  if (typeof body.question !== "string" || !body.question.trim()) {
    response.status(400).json({ message: "Enter a question to continue." });
    return;
  }
  if (body.question.length > maximumQuestionCharacters) {
    response.status(400).json({ message: `Questions must be ${maximumQuestionCharacters} characters or fewer.` });
    return;
  }

  let history: z.infer<typeof historyMessageSchema>[] = [];
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      response.status(400).json({ message: "Conversation history must be a list of user and assistant messages." });
      return;
    }
    if (body.history.length > maximumHistoryMessages) {
      response.status(400).json({ message: `Conversation history may contain at most ${maximumHistoryMessages} recent messages.` });
      return;
    }
    const parsedHistory = z.array(historyMessageSchema).safeParse(body.history);
    if (!parsedHistory.success) {
      response.status(400).json({ message: "Conversation history contains an invalid message or unsupported role." });
      return;
    }
    history = parsedHistory.data;
  }

  const service = requestStudyAssistant(request);
  if (!service) {
    response.status(503).json({ message: "The study assistant is not configured right now." });
    return;
  }

  try {
    const answer = await service.answerQuestion({
      courseId: body.courseId,
      userId: String(request.userId),
      question: body.question.trim(),
      history,
    });
    response.json({ answer });
  } catch (error) {
    sendAskError(response, error);
  }
});

export default aiRouter;
