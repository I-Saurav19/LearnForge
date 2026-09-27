import { Types, type HydratedDocument } from "mongoose";
import type { AIService } from "../ai/index.js";
import { Course } from "../../models/Course.js";
import { Document, type DocumentRecord } from "../../models/Document.js";
import { buildCourseGenerationInstructions } from "./course-generation-prompt.js";
import { generatedCourseSchema } from "./course-schema.js";

export class CourseServiceError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "CourseServiceError";
  }
}

export class CourseSourceNotFoundError extends CourseServiceError {
  constructor() {
    super("Document not found.", 404, "DOCUMENT_NOT_FOUND");
    this.name = "CourseSourceNotFoundError";
  }
}

export class CourseSourceTextEmptyError extends CourseServiceError {
  constructor() {
    super("This document does not contain extracted text. Upload or process a readable document first.", 422, "DOCUMENT_TEXT_EMPTY");
    this.name = "CourseSourceTextEmptyError";
  }
}

export class CoursePersistenceError extends CourseServiceError {
  constructor() {
    super("Unable to save or load courses right now.", 500, "COURSE_DATABASE_ERROR");
    this.name = "CoursePersistenceError";
  }
}

export interface GeneratedCourseResult {
  course: InstanceType<typeof Course>;
  created: boolean;
}

export class CourseService {
  constructor(private readonly aiService: AIService) {}

  async generateFromDocument(documentId: string, userId: string): Promise<GeneratedCourseResult> {
    let document: HydratedDocument<DocumentRecord> | null;
    try {
      document = await Document.findOne({ _id: documentId, userId }).select("filename extractedText");
    } catch {
      throw new CoursePersistenceError();
    }
    if (!document) throw new CourseSourceNotFoundError();
    if (!document.extractedText?.trim()) throw new CourseSourceTextEmptyError();

    let existing: InstanceType<typeof Course> | null;
    try {
      existing = await Course.findOne({ userId, documentId });
    } catch {
      throw new CoursePersistenceError();
    }
    if (existing) return { course: existing, created: false };

    const content = await this.aiService.generateCourse({
      materialText: document.extractedText,
      instructions: buildCourseGenerationInstructions(),
      outputSchema: generatedCourseSchema,
    });

    const course = new Course({
      userId: new Types.ObjectId(userId),
      documentId: new Types.ObjectId(documentId),
      title: content.title,
      description: content.description,
      topics: content.topics,
    });

    try {
      await course.save();
      return { course, created: true };
    } catch (error) {
      if ((error as { code?: unknown })?.code === 11000) {
        try {
          const duplicate = await Course.findOne({ userId, documentId });
          if (duplicate) return { course: duplicate, created: false };
        } catch {
          throw new CoursePersistenceError();
        }
      }
      throw new CoursePersistenceError();
    }
  }

}
