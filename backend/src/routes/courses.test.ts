import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-only-course-secret-for-signed-authenticated-tests";
});

import jwt from "jsonwebtoken";
import request from "supertest";
import { Types } from "mongoose";
import { Course } from "../models/Course.js";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import app from "../app.js";
import { env } from "../config/env.js";
import { AIProviderError, AIService, type AIProvider } from "../services/ai/index.js";
import { generatedCourseSchema, type GeneratedCourseContent } from "../services/courses/course-schema.js";

const userA = "507f1f77bcf86cd799439011";
const userB = "507f1f77bcf86cd799439022";
const documentId = "507f1f77bcf86cd799439033";
const courseIdForOther = "507f1f77bcf86cd799439044";
const secret = env.authSecret as string;
const generatedContent: GeneratedCourseContent = {
  title: "Cell Biology Foundations",
  description: "A short course about cell structure and function.",
  topics: [{
    title: "Cell Structure",
    explanation: "Cells contain structures that perform specialized functions.",
    importantConcepts: ["Organelles"],
    examples: [],
    keyPoints: ["Each organelle has a role."],
  }],
};

const savedCourses = new Map<string, InstanceType<typeof Course>>();
let sourceDocument: InstanceType<typeof Document> | null;
let generateCourseMock: ReturnType<typeof vi.fn>;

function sessionFor(userId: string) {
  const token = jwt.sign({}, secret, { subject: userId, expiresIn: "1h" });
  return `learnforge_session=${token}`;
}

function authenticated(userId: string, endpoint: string, method: "get" | "post" = "post") {
  return request(app)[method](endpoint).set("Cookie", sessionFor(userId));
}

function createStoredCourse(ownerId: string, sourceId: string, id?: string) {
  const course = new Course({ userId: ownerId, documentId: sourceId, ...generatedContent });
  if (id) course._id = new Types.ObjectId(id);
  savedCourses.set(course.id, course);
  return course;
}

describe("course API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    savedCourses.clear();
    sourceDocument = new Document({
      _id: documentId,
      userId: userA,
      filename: "biology.txt",
      fileType: "txt",
      extractedText: "Cells contain a membrane and specialized organelles.",
      storageKey: "not-used-by-course-api",
    });
    generateCourseMock = vi.fn(async () => generatedContent);
    app.locals.aiService = { generateCourse: generateCourseMock };

    vi.spyOn(User, "findById").mockImplementation(((id: string) => ({
      select: vi.fn().mockResolvedValue({ id: String(id) }),
    })) as never);
    vi.spyOn(Document, "findOne").mockImplementation(((filter: { userId: string }) => ({
      select: vi.fn().mockResolvedValue(sourceDocument && String(sourceDocument.userId) === String(filter.userId) ? sourceDocument : null),
    })) as never);
    vi.spyOn(Course.prototype, "save").mockImplementation((function (this: InstanceType<typeof Course>) {
      savedCourses.set(this.id, this);
      return Promise.resolve(this);
    }) as never);
    vi.spyOn(Course, "findOne").mockImplementation(((filter: { _id?: string; documentId?: string; userId: string }) => {
      const found = Array.from(savedCourses.values()).find((course) =>
        String(course.userId) === String(filter.userId)
        && (filter._id ? course.id === String(filter._id) : String(course.documentId) === String(filter.documentId)),
      ) ?? null;
      const query = Promise.resolve(found) as Promise<typeof found> & { select: () => Promise<typeof found> };
      query.select = () => Promise.resolve(found);
      return query;
    }) as never);
    vi.spyOn(Course, "find").mockImplementation(((filter: { userId: string }) => ({
      sort: () => ({ select: () => Promise.resolve(Array.from(savedCourses.values()).filter((course) => String(course.userId) === String(filter.userId))) }),
    })) as never);
  });

  afterAll(() => {
    delete app.locals.aiService;
  });

  it("generates and saves a course for an authenticated document owner", async () => {
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(201);
    expect(response.body.course).toMatchObject({ title: generatedContent.title, topics: [{ title: "Cell Structure" }] });
    expect(response.body.course).not.toHaveProperty("documentId");
    expect(response.body.course).not.toHaveProperty("userId");
    expect(generateCourseMock).toHaveBeenCalledOnce();
    expect(generateCourseMock.mock.calls[0]?.[0]).toMatchObject({
      materialText: sourceDocument?.extractedText,
      outputSchema: generatedCourseSchema,
    });
    expect(Array.from(savedCourses.values())[0]).toMatchObject({ title: generatedContent.title, description: generatedContent.description });
  });

  it("rejects unauthenticated course generation", async () => {
    const response = await request(app).post("/api/courses/generate").send({ documentId });
    expect(response.status).toBe(401);
    expect(generateCourseMock).not.toHaveBeenCalled();
  });

  it("does not generate a course from another user's document", async () => {
    sourceDocument!.userId = new Types.ObjectId(userB);
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(404);
    expect(generateCourseMock).not.toHaveBeenCalled();
  });

  it("validates the document identifier and required request field", async () => {
    const missing = await authenticated(userA, "/api/courses/generate").send({});
    const invalid = await authenticated(userA, "/api/courses/generate").send({ documentId: "not-an-id" });
    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(generateCourseMock).not.toHaveBeenCalled();
  });

  it("returns not found and empty-text errors before invoking AI", async () => {
    sourceDocument = null;
    const missing = await authenticated(userA, "/api/courses/generate").send({ documentId });
    sourceDocument = new Document({ _id: documentId, userId: userA, extractedText: "  " });
    const empty = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(missing.status).toBe(404);
    expect(empty.status).toBe(422);
    expect(generateCourseMock).not.toHaveBeenCalled();
  });

  it("normalizes provider failures into a safe API response", async () => {
    generateCourseMock.mockRejectedValueOnce(new AIProviderError("private Gemini error containing provider details", "AI_RATE_LIMITED"));
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(503);
    expect(response.body.message).toContain("too many requests");
    expect(response.body.message).toContain("too many requests");
    expect(JSON.stringify(response.body)).not.toContain("private Gemini error");
  });

  it("rejects invalid structured AI output without persisting a course", async () => {
    const invalidProvider: AIProvider = {
      generateCourse: vi.fn(async () => ({ title: "", description: "Missing fields", topics: [] })),
      answerQuestion: vi.fn(async () => "unused"),
      generateQuiz: vi.fn(async () => ({})),
    };
    app.locals.aiService = new AIService(invalidProvider, 100_000);
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(502);
    expect(savedCourses.size).toBe(0);
    expect(response.body.message).toMatch(/could not be validated/);
  });

  it("rejects oversized source text instead of silently truncating it", async () => {
    const provider: AIProvider = {
      generateCourse: vi.fn(async () => generatedContent),
      answerQuestion: vi.fn(async () => "unused"),
      generateQuiz: vi.fn(async () => generatedContent),
    };
    app.locals.aiService = new AIService(provider, 10);
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(413);
    expect(response.body.message).toMatch(/too large to process/);
    expect(provider.generateCourse).not.toHaveBeenCalled();
    expect(savedCourses.size).toBe(0);
  });

  it("returns an existing course rather than creating duplicates", async () => {
    const existing = createStoredCourse(userA, documentId);
    const response = await authenticated(userA, "/api/courses/generate").send({ documentId });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ existing: true, course: { id: existing.id } });
    expect(generateCourseMock).not.toHaveBeenCalled();
    expect(savedCourses.size).toBe(1);
  });

  it("lists only the authenticated user's courses", async () => {
    createStoredCourse(userA, documentId);
    createStoredCourse(userB, "507f1f77bcf86cd799439055");
    const response = await authenticated(userA, "/api/courses", "get");
    expect(response.status).toBe(200);
    expect(response.body.courses).toHaveLength(1);
    expect(response.body.courses[0].title).toBe(generatedContent.title);
    expect(response.body.courses[0].topicCount).toBe(1);
    expect(response.body.courses[0]).not.toHaveProperty("topics");
  });

  it("does not allow a user to retrieve another user's course", async () => {
    createStoredCourse(userB, documentId, courseIdForOther);
    const response = await authenticated(userA, `/api/courses/${courseIdForOther}`, "get");
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Course not found.");
  });
});
