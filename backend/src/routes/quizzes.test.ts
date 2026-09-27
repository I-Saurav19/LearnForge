import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.AUTH_SECRET = "test-only-quiz-secret-for-authenticated-tests"; });

import jwt from "jsonwebtoken";
import request from "supertest";
import { env } from "../config/env.js";
import { Course } from "../models/Course.js";
import { Document } from "../models/Document.js";
import { Quiz } from "../models/Quiz.js";
import { QuizResult } from "../models/QuizResult.js";
import { User } from "../models/User.js";
import app from "../app.js";
import { AIProviderError, AIService, type AIProvider, type QuizGenerationRequest } from "../services/ai/index.js";

const ownerId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439022";
const courseId = "507f1f77bcf86cd799439033";
const documentId = "507f1f77bcf86cd799439044";
const quizId = "507f1f77bcf86cd799439055";
const resultId = "507f1f77bcf86cd799439066";
const secret = env.authSecret as string;

let courseFixture: InstanceType<typeof Course> | null;
let documentFixture: InstanceType<typeof Document> | null;
let quizFixture: InstanceType<typeof Quiz> | null;
let resultFixture: InstanceType<typeof QuizResult> | null;
let provider: AIProvider;
let savedQuiz: InstanceType<typeof Quiz> | null;
let savedResult: InstanceType<typeof QuizResult> | null;

function sessionFor(userId: string) {
  return `learnforge_session=${jwt.sign({}, secret, { subject: userId, expiresIn: "1h" })}`;
}

function postGenerate(userId: string, body: unknown) {
  return request(app).post("/api/quizzes/generate").set("Cookie", sessionFor(userId)).send(body);
}

function generatedQuestions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    options: ["First", "Second", "Third", "Fourth"],
    correctAnswer: "First",
    explanation: `Explanation ${index + 1}.`,
  }));
}

describe("quiz API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    savedQuiz = null;
    savedResult = null;
    courseFixture = new Course({ _id: courseId, userId: ownerId, documentId, title: "Operating Systems", description: "Processes and programs", topics: [{ title: "Processes", explanation: "A process is an executing program.", importantConcepts: ["process"], examples: [], keyPoints: ["Execution"] }] });
    documentFixture = new Document({ _id: documentId, userId: ownerId, filename: "notes.txt", fileType: "txt", extractedText: "A process is an executing program.", storageKey: "private" });
    quizFixture = new Quiz({ _id: quizId, userId: ownerId, courseId, questions: generatedQuestions(5) });
    resultFixture = new QuizResult({ _id: resultId, userId: ownerId, quizId, score: 1, totalQuestions: 5, answers: [] });
    provider = {
      generateCourse: vi.fn(async () => ({})),
      answerQuestion: vi.fn(async () => "answer"),
      generateQuiz: vi.fn(async (input: QuizGenerationRequest<unknown>) => ({ questions: generatedQuestions(input.questionCount ?? 5) })),
    };
    app.locals.aiService = new AIService(provider, 100_000, 12);

    vi.spyOn(User, "findById").mockImplementation(((id: string) => ({ select: vi.fn().mockResolvedValue({ id: String(id) }) })) as never);
    vi.spyOn(Course, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(courseFixture && String(courseFixture.id) === String(filter._id) && String(courseFixture.userId) === String(filter.userId) ? courseFixture : null),
    })) as never);
    vi.spyOn(Document, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(documentFixture && String(documentFixture.id) === String(filter._id) && String(documentFixture.userId) === String(filter.userId) ? documentFixture : null),
    })) as never);
    vi.spyOn(Quiz.prototype, "save").mockImplementation((async function (this: InstanceType<typeof Quiz>) {
      savedQuiz = this;
      return this;
    }) as never);
    vi.spyOn(Quiz, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(quizFixture && String(quizFixture.id) === String(filter._id) && String(quizFixture.userId) === String(filter.userId) ? quizFixture : null),
    })) as never);
    vi.spyOn(QuizResult.prototype, "save").mockImplementation((async function (this: InstanceType<typeof QuizResult>) {
      savedResult = this;
      return this;
    }) as never);
    vi.spyOn(QuizResult, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(resultFixture && String(resultFixture.id) === String(filter._id) && String(resultFixture.userId) === String(filter.userId) ? resultFixture : null),
    })) as never);
  });

  afterAll(() => { delete app.locals.aiService; });

  it("generates, validates, and saves a quiz for the authenticated course owner", async () => {
    const response = await postGenerate(ownerId, { courseId, questionCount: 5, userId: otherUserId });
    expect(response.status).toBe(201);
    expect(response.body.quiz).toMatchObject({ courseId, questionCount: 5 });
    expect(JSON.stringify(response.body)).not.toContain("correctAnswer");
    expect(JSON.stringify(response.body)).not.toContain("explanation");
    expect(savedQuiz).not.toBeNull();
    expect(savedQuiz?.questions).toHaveLength(5);
    const requestToAI = vi.mocked(provider.generateQuiz).mock.calls[0]?.[0];
    expect(requestToAI).toMatchObject({
      materialText: documentFixture?.extractedText,
      questionCount: 5,
      courseContext: { title: "Operating Systems", description: "Processes and programs", topicTitles: ["Processes"] },
    });
    expect(requestToAI?.instructions).toContain("exactly 5");
    expect(String(vi.mocked(Course.findOne).mock.calls[0]?.[0].userId)).toBe(ownerId);
    expect(String(vi.mocked(Document.findOne).mock.calls[0]?.[0].userId)).toBe(ownerId);
  });

  it("requires authentication and rejects foreign or invalid courses", async () => {
    const unauthenticated = await request(app).post("/api/quizzes/generate").send({ courseId, questionCount: 5 });
    const foreign = await postGenerate(otherUserId, { courseId, questionCount: 5 });
    const invalid = await postGenerate(ownerId, { courseId: "bad-id", questionCount: 5 });
    expect(unauthenticated.status).toBe(401);
    expect(foreign.status).toBe(404);
    expect(invalid.status).toBe(400);
    expect(provider.generateQuiz).not.toHaveBeenCalled();
  });

  it("rejects unsupported question counts and empty or inaccessible source documents", async () => {
    const countError = await postGenerate(ownerId, { courseId, questionCount: 500 });
    documentFixture!.extractedText = "  ";
    const emptyText = await postGenerate(ownerId, { courseId, questionCount: 5 });
    documentFixture = null;
    const foreignDocument = await postGenerate(ownerId, { courseId, questionCount: 5 });
    expect(countError.status).toBe(400);
    expect(emptyText.status).toBe(422);
    expect(foreignDocument.status).toBe(404);
  });

  it("does not save provider failures or invalid generated output", async () => {
    const failing: AIProvider = { ...provider, generateQuiz: vi.fn(async () => { throw new AIProviderError("private details"); }) };
    app.locals.aiService = new AIService(failing);
    const failure = await postGenerate(ownerId, { courseId, questionCount: 5 });
    expect(failure.status).toBe(502);
    expect(JSON.stringify(failure.body)).not.toContain("private details");
    expect(savedQuiz).toBeNull();

    const invalid: AIProvider = { ...provider, generateQuiz: vi.fn(async () => ({ questions: generatedQuestions(4) })) };
    app.locals.aiService = new AIService(invalid);
    const invalidOutput = await postGenerate(ownerId, { courseId, questionCount: 5 });
    expect(invalidOutput.status).toBe(502);
    expect(savedQuiz).toBeNull();
  });

  it("retrieves a sanitized quiz for its owner only", async () => {
    const response = await request(app).get(`/api/quizzes/${quizId}`).set("Cookie", sessionFor(ownerId));
    const foreign = await request(app).get(`/api/quizzes/${quizId}`).set("Cookie", sessionFor(otherUserId));
    expect(response.status).toBe(200);
    expect(response.body.quiz.questions).toHaveLength(5);
    expect(response.body.quiz.questions[0]).toHaveProperty("id");
    expect(response.body.quiz.questions[0]).toHaveProperty("question");
    expect(response.body.quiz.questions[0]).toHaveProperty("options");
    expect(JSON.stringify(response.body)).not.toContain("correctAnswer");
    expect(JSON.stringify(response.body)).not.toContain("explanation");
    expect(foreign.status).toBe(404);
    expect(String(vi.mocked(Quiz.findOne).mock.calls[0]?.[0].userId)).toBe(ownerId);
  });

  function validAnswers() {
    return quizFixture!.questions.map((question, index) => ({
      questionId: question._id!.toString(),
      selectedAnswer: index === 0 ? question.correctAnswer : question.options[1]!,
    }));
  }

  it("scores complete submissions on the server and saves independent attempts", async () => {
    const payload = { answers: validAnswers() };
    const first = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send(payload);
    const second = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send(payload);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ quizId, score: 1, totalQuestions: 5, percentage: 20 });
    expect(first.body.resultId).toBeTruthy();
    expect(savedResult?.score).toBe(1);
    expect(savedResult?.totalQuestions).toBe(5);
    expect(savedResult?.answers.map((answer) => answer.isCorrect)).toEqual([true, false, false, false, false]);
    expect(second.status).toBe(201);
    expect(vi.mocked(QuizResult.prototype.save)).toHaveBeenCalledTimes(2);
  });

  it("rejects unauthenticated, foreign, and missing quiz submissions", async () => {
    const answers = validAnswers();
    const unauthenticated = await request(app).post(`/api/quizzes/${quizId}/submit`).send({ answers });
    const foreign = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(otherUserId)).send({ answers });
    quizFixture = null;
    const missing = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers });
    expect(unauthenticated.status).toBe(401);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(savedResult).toBeNull();
  });

  it("rejects incomplete, duplicate, malformed, unknown, and invalid option answers", async () => {
    const complete = validAnswers();
    const incomplete = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: complete.slice(1) });
    const duplicate = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: [complete[0], complete[0], ...complete.slice(2)] });
    const malformedId = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: [{ questionId: "bad", selectedAnswer: "First" }] });
    const invalidOptionAnswers = complete.map((answer, index) => index === 0 ? { ...answer, selectedAnswer: "Not an option" } : answer);
    const invalidOption = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: invalidOptionAnswers });
    const unknownAnswers = complete.map((answer, index) => index === 0 ? { ...answer, questionId: "507f1f77bcf86cd799439099" } : answer);
    const unknownQuestion = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: unknownAnswers });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.message).toContain("answer all questions");
    expect(duplicate.status).toBe(400);
    expect(malformedId.status).toBe(400);
    expect(invalidOption.status).toBe(400);
    expect(unknownQuestion.status).toBe(400);
    expect(savedResult).toBeNull();
  });

  it("rejects client-supplied score, percentage, or correctness values", async () => {
    const complete = validAnswers();
    const clientScore = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: complete, score: 5 });
    const clientPercentage = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: complete, percentage: 100 });
    const clientCorrectness = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: complete.map((answer) => ({ ...answer, isCorrect: true })) });
    expect(clientScore.status).toBe(400);
    expect(clientPercentage.status).toBe(400);
    expect(clientCorrectness.status).toBe(400);
    expect(savedResult).toBeNull();
  });

  it("returns answer review only to the result owner with explanations and correct answers", async () => {
    const posted = await request(app).post(`/api/quizzes/${quizId}/submit`).set("Cookie", sessionFor(ownerId)).send({ answers: validAnswers() });
    resultFixture = savedResult;
    const review = await request(app).get(`/api/quizzes/results/${posted.body.resultId}`).set("Cookie", sessionFor(ownerId));
    const forbidden = await request(app).get(`/api/quizzes/results/${posted.body.resultId}`).set("Cookie", sessionFor(otherUserId));
    expect(review.status).toBe(200);
    expect(review.body.result).toMatchObject({ score: 1, totalQuestions: 5, percentage: 20, courseId });
    expect(review.body.result.answers[0]).toMatchObject({
      question: "Question 1?",
      selectedAnswer: "First",
      correctAnswer: "First",
      explanation: "Explanation 1.",
      isCorrect: true,
    });
    expect(forbidden.status).toBe(404);
  });
});
