import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AIContextTooLargeError, AIProviderError, AIResponseError, AIService } from "../services/ai/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { Quiz } from "../models/Quiz.js";
import { QuizService, QuizServiceError, supportedQuestionCounts } from "../services/quizzes/quiz.service.js";
import { QuizAttemptService } from "../services/quizzes/quiz-attempt.service.js";

const quizzesRouter = Router();
const submittedAnswerSchema = z.object({
  questionId: z.string().regex(/^[a-f\d]{24}$/i),
  selectedAnswer: z.string().trim().min(1).max(500),
}).strict();
const submissionSchema = z.object({ answers: z.array(submittedAnswerSchema).min(1).max(15) }).strict();
quizzesRouter.use(requireAuth);

function validId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function requestQuizService(request: Request): QuizService | null {
  const aiService = request.app.locals.aiService as AIService | undefined;
  return aiService ? new QuizService(aiService) : null;
}

function sendQuizError(response: Response, error: unknown): void {
  if (error instanceof QuizServiceError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof AIContextTooLargeError) {
    response.status(413).json({ message: "This study material is too large to generate a quiz. Use a shorter source document." });
    return;
  }
  if (error instanceof AIResponseError) {
    response.status(502).json({ message: "The AI returned quiz data that could not be validated. Please try again." });
    return;
  }
  if (error instanceof AIProviderError) {
    const rateLimited = error.code === "AI_RATE_LIMITED";
    response.status(rateLimited ? 503 : 502).json({
      message: rateLimited
        ? "The quiz generator is receiving too many requests. Please try again shortly."
        : "The quiz generator is temporarily unavailable. Please try again.",
    });
    return;
  }
  response.status(500).json({ message: "Unable to generate or load this quiz right now." });
}

quizzesRouter.post("/generate", async (request: Request, response: Response) => {
  const body = request.body as { courseId?: unknown; questionCount?: unknown } | null;
  if (typeof body?.courseId !== "string" || !body.courseId) {
    response.status(400).json({ message: "A courseId is required." });
    return;
  }
  if (!validId(body.courseId)) {
    response.status(400).json({ message: "The course ID is invalid." });
    return;
  }
  if (!supportedQuestionCounts.includes(body.questionCount as (typeof supportedQuestionCounts)[number])) {
    response.status(400).json({ message: "Choose 5, 10, or 15 questions." });
    return;
  }
  const service = requestQuizService(request);
  if (!service) {
    response.status(503).json({ message: "Quiz generation is not configured right now." });
    return;
  }
  try {
    const quiz = await service.generateForCourse(body.courseId, String(request.userId), body.questionCount as (typeof supportedQuestionCounts)[number]);
    response.status(201).json({ quiz: { id: quiz.id, courseId: String(quiz.courseId), createdAt: quiz.createdAt, questionCount: quiz.questions.length } });
  } catch (error) {
    sendQuizError(response, error);
  }
});

quizzesRouter.post("/:id/submit", async (request: Request, response: Response) => {
  const quizId = Array.isArray(request.params.id) ? request.params.id[0] ?? "" : request.params.id;
  if (!validId(quizId)) {
    response.status(400).json({ message: "The quiz ID is invalid." });
    return;
  }
  const parsed = submissionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Submit one valid selected option for every question. Scores and correctness values are not accepted." });
    return;
  }
  try {
    const { result, score, totalQuestions, percentage } = await new QuizAttemptService().submit(quizId, String(request.userId), parsed.data.answers);
    response.status(201).json({ resultId: result.id, quizId, score, totalQuestions, percentage });
  } catch (error) {
    sendQuizError(response, error);
  }
});

quizzesRouter.get("/:id", async (request: Request, response: Response) => {
  const quizId = Array.isArray(request.params.id) ? request.params.id[0] ?? "" : request.params.id;
  if (!validId(quizId)) {
    response.status(400).json({ message: "The quiz ID is invalid." });
    return;
  }
  try {
    const quiz = await Quiz.findOne({ _id: quizId, userId: request.userId }).select("courseId questions createdAt");
    if (!quiz) {
      response.status(404).json({ message: "Quiz not found." });
      return;
    }
    response.json({
      quiz: {
        id: quiz.id,
        courseId: String(quiz.courseId),
        questions: quiz.questions.map((question) => ({
          id: question._id?.toString(),
          question: question.question,
          options: question.options,
        })),
      },
    });
  } catch {
    sendQuizError(response, new Error("database"));
  }
});

quizzesRouter.get("/results/:resultId", async (request: Request, response: Response) => {
  const resultId = Array.isArray(request.params.resultId) ? request.params.resultId[0] ?? "" : request.params.resultId;
  if (!validId(resultId)) {
    response.status(400).json({ message: "The result ID is invalid." });
    return;
  }
  try {
    response.json({ result: await new QuizAttemptService().getReview(resultId, String(request.userId)) });
  } catch (error) {
    sendQuizError(response, error);
  }
});

export default quizzesRouter;
