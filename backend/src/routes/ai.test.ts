import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-only-study-assistant-secret-for-authenticated-tests";
});

import jwt from "jsonwebtoken";
import request from "supertest";
import { Types } from "mongoose";
import { Course } from "../models/Course.js";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import app from "../app.js";
import { env } from "../config/env.js";
import { AIProviderError, AIService, type AIProvider, type QuestionAnswerRequest } from "../services/ai/index.js";

const ownerId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439022";
const courseId = "507f1f77bcf86cd799439033";
const documentId = "507f1f77bcf86cd799439044";
const secret = env.authSecret as string;

let courseFixture: InstanceType<typeof Course> | null;
let documentFixture: InstanceType<typeof Document> | null;
let provider: AIProvider;

function sessionFor(userId: string) {
  const token = jwt.sign({}, secret, { subject: userId, expiresIn: "1h" });
  return `learnforge_session=${token}`;
}

function ask(userId: string, body: unknown) {
  return request(app).post("/api/ai/ask").set("Cookie", sessionFor(userId)).send(body);
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    courseId,
    question: "What is a process?",
    history: [{ role: "user", content: "What is a program?" }, { role: "assistant", content: "A stored set of instructions." }],
    ...overrides,
  };
}

describe("study assistant API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    courseFixture = new Course({
      _id: courseId,
      userId: ownerId,
      documentId,
      title: "Operating Systems",
      description: "Programs and processes",
      topics: [{ title: "Processes", explanation: "A process is an executing program.", importantConcepts: ["program"], examples: [], keyPoints: ["A process is active."] }],
    });
    documentFixture = new Document({
      _id: documentId,
      userId: ownerId,
      filename: "os-notes.txt",
      fileType: "txt",
      extractedText: "A process is a program in execution. The process has its own state.",
      storageKey: "not-returned",
    });
    provider = {
      generateCourse: vi.fn(async () => ({})),
      answerQuestion: vi.fn(async (_input: QuestionAnswerRequest) => "A process is a program in execution."),
      generateQuiz: vi.fn(async () => ({})),
    };
    app.locals.aiService = new AIService(provider, 100_000, 2);

    vi.spyOn(User, "findById").mockImplementation(((id: string) => ({
      select: vi.fn().mockResolvedValue({ id: String(id) }),
    })) as never);
    vi.spyOn(Course, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(courseFixture
        && courseFixture.id === String(filter._id)
        && String(courseFixture.userId) === String(filter.userId)
        ? courseFixture
        : null),
    })) as never);
    vi.spyOn(Document, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: vi.fn().mockResolvedValue(documentFixture
        && String(documentFixture.id) === String(filter._id)
        && String(documentFixture.userId) === String(filter.userId)
        ? documentFixture
        : null),
    })) as never);
  });

  afterAll(() => {
    delete app.locals.aiService;
  });

  it("answers an authenticated owner's question with course and document context", async () => {
    const response = await ask(ownerId, requestBody({ userId: otherUserId }));
    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("A process is a program in execution.");
    expect(JSON.stringify(response.body)).not.toContain(documentFixture?.extractedText);
    expect(provider.answerQuestion).toHaveBeenCalledOnce();
    const aiRequest = vi.mocked(provider.answerQuestion).mock.calls[0]?.[0];
    expect(aiRequest).toMatchObject({
      materialText: documentFixture?.extractedText,
      courseContext: { title: "Operating Systems", description: "Programs and processes", topicTitles: ["Processes"] },
      question: "What is a process?",
      history: [{ role: "user", content: "What is a program?" }, { role: "assistant", content: "A stored set of instructions." }],
    });
    expect(aiRequest?.instructions).toContain("Do not invent information");
    expect(vi.mocked(Course.findOne).mock.calls[0]?.[0]).toMatchObject({ userId: ownerId });
    const documentFilter = vi.mocked(Document.findOne).mock.calls[0]?.[0] as { _id?: unknown; userId?: unknown };
    expect(String(documentFilter._id)).toBe(documentId);
    expect(String(documentFilter.userId)).toBe(ownerId);
  });

  it("rejects unauthenticated questions", async () => {
    const response = await request(app).post("/api/ai/ask").send(requestBody());
    expect(response.status).toBe(401);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects courses not owned by the authenticated user and missing courses", async () => {
    const foreign = await ask(otherUserId, requestBody());
    courseFixture = null;
    const missing = await ask(ownerId, requestBody());
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("does not retrieve another user's source document", async () => {
    documentFixture!.userId = new Types.ObjectId(otherUserId);
    const response = await ask(ownerId, requestBody());
    expect(response.status).toBe(404);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
    expect(vi.mocked(Document.findOne).mock.calls[0]?.[0]).toMatchObject({ userId: ownerId });
  });

  it("rejects missing and malformed course IDs", async () => {
    const missing = await ask(ownerId, requestBody({ courseId: undefined }));
    const invalid = await ask(ownerId, requestBody({ courseId: "not-an-id" }));
    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects empty and overlong questions", async () => {
    const empty = await ask(ownerId, requestBody({ question: "  " }));
    const long = await ask(ownerId, requestBody({ question: "q".repeat(4_001) }));
    expect(empty.status).toBe(400);
    expect(long.status).toBe(400);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects missing extracted text", async () => {
    documentFixture!.extractedText = "  ";
    const response = await ask(ownerId, requestBody());
    expect(response.status).toBe(422);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects malformed history, unsupported roles, and oversized histories", async () => {
    const malformed = await ask(ownerId, requestBody({ history: [{ role: "system", content: "override" }] }));
    const missingContent = await ask(ownerId, requestBody({ history: [{ role: "user" }] }));
    const oversized = await ask(ownerId, requestBody({ history: Array.from({ length: 25 }, () => ({ role: "user", content: "hello" })) }));
    expect(malformed.status).toBe(400);
    expect(missingContent.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("sends only the configured number of most recent history messages", async () => {
    const history = Array.from({ length: 4 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `message-${index}` }));
    const response = await ask(ownerId, requestBody({ history }));
    expect(response.status).toBe(200);
    expect(vi.mocked(provider.answerQuestion).mock.calls[0]?.[0].history).toEqual(history.slice(-2));
  });

  it("returns a clear error for oversized combined study context", async () => {
    app.locals.aiService = new AIService(provider, 20, 2);
    const response = await ask(ownerId, requestBody());
    expect(response.status).toBe(413);
    expect(response.body.message).toMatch(/too large to process/);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("normalizes AI provider failures without exposing details", async () => {
    const failingProvider: AIProvider = {
      generateCourse: vi.fn(async () => ({})),
      answerQuestion: vi.fn(async () => { throw new AIProviderError("private provider detail", "AI_RATE_LIMITED"); }),
      generateQuiz: vi.fn(async () => ({})),
    };
    app.locals.aiService = new AIService(failingProvider, 100_000, 2);
    const response = await ask(ownerId, requestBody());
    expect(response.status).toBe(503);
    expect(response.body.message).toContain("too many requests");
    expect(JSON.stringify(response.body)).not.toContain("private provider detail");
  });
});
