import { Router, type Request, type Response } from "express";
import { AIContextTooLargeError, AIProviderError, AIResponseError, AIService } from "../services/ai/index.js";
import { Course } from "../models/Course.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { CourseService, CourseServiceError } from "../services/courses/course.service.js";

const coursesRouter = Router();
coursesRouter.use(requireAuth);

function validId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function courseView(course: InstanceType<typeof Course>) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    topics: course.topics.map((topic) => ({
      id: topic._id?.toString(),
      title: topic.title,
      explanation: topic.explanation,
      importantConcepts: topic.importantConcepts,
      examples: topic.examples,
      keyPoints: topic.keyPoints,
    })),
    createdAt: course.createdAt,
  };
}

function requestCourseService(request: Request): CourseService | null {
  const aiService = request.app.locals.aiService as AIService | undefined;
  return aiService ? new CourseService(aiService) : null;
}

function sendGenerationError(response: Response, error: unknown): void {
  if (error instanceof CourseServiceError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof AIContextTooLargeError) {
    response.status(413).json({ message: "This document is too large to process. Shorten or split the source document and upload it again." });
    return;
  }
  if (error instanceof AIResponseError) {
    response.status(502).json({ message: "The AI returned course data that could not be validated. Please try again." });
    return;
  }
  if (error instanceof AIProviderError) {
    const rateLimited = error.code === "AI_RATE_LIMITED";
    response.status(rateLimited ? 503 : 502).json({
      message: rateLimited
        ? "The course generator is receiving too many requests. Please try again shortly."
        : "The course generator is temporarily unavailable. Please try again.",
    });
    return;
  }
  response.status(500).json({ message: "Unable to generate or load the course right now." });
}

coursesRouter.post("/generate", async (request: Request, response: Response) => {
  const documentId = request.body && typeof request.body.documentId === "string" ? request.body.documentId : "";
  if (!documentId) {
    response.status(400).json({ message: "A documentId is required." });
    return;
  }
  if (!validId(documentId)) {
    response.status(400).json({ message: "The document ID is invalid." });
    return;
  }

  const service = requestCourseService(request);
  if (!service) {
    response.status(503).json({ message: "Course generation is not configured right now." });
    return;
  }

  try {
    const result = await service.generateFromDocument(documentId, String(request.userId));
    response.status(result.created ? 201 : 200).json({ course: courseView(result.course), existing: !result.created });
  } catch (error) {
    sendGenerationError(response, error);
  }
});

coursesRouter.get("/", async (request: Request, response: Response) => {
  try {
    const courses = await Course.find({ userId: request.userId }).sort({ createdAt: -1 }).select("title description topics createdAt");
    response.json({ courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      topicCount: course.topics.length,
      createdAt: course.createdAt,
    })) });
  } catch {
    response.status(500).json({ message: "Unable to load your courses right now." });
  }
});

coursesRouter.get("/:id", async (request: Request, response: Response) => {
  const courseId = Array.isArray(request.params.id) ? request.params.id[0] ?? "" : request.params.id;
  if (!validId(courseId)) {
    response.status(400).json({ message: "The course ID is invalid." });
    return;
  }
  try {
    const course = await Course.findOne({ _id: courseId, userId: request.userId }).select("title description topics createdAt");
    if (!course) {
      response.status(404).json({ message: "Course not found." });
      return;
    }
    response.json({ course: courseView(course) });
  } catch {
    response.status(500).json({ message: "Unable to load this course right now." });
  }
});

export default coursesRouter;
