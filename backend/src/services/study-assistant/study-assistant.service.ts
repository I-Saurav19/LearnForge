import type { HydratedDocument } from "mongoose";
import type { AIConversationMessage, AIService } from "../ai/index.js";
import { Course, type CourseRecord } from "../../models/Course.js";
import { Document, type DocumentRecord } from "../../models/Document.js";
import { buildStudyAssistantInstructions } from "../ai/study-assistant-prompt.js";

export class StudyAssistantError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "StudyAssistantError";
  }
}

export class StudyAssistantCourseNotFoundError extends StudyAssistantError {
  constructor() {
    super("Course not found.", 404, "COURSE_NOT_FOUND");
    this.name = "StudyAssistantCourseNotFoundError";
  }
}

export class StudyAssistantDocumentNotFoundError extends StudyAssistantError {
  constructor() {
    super("The study material for this course could not be found.", 404, "DOCUMENT_NOT_FOUND");
    this.name = "StudyAssistantDocumentNotFoundError";
  }
}

export class StudyAssistantEmptyDocumentError extends StudyAssistantError {
  constructor() {
    super("This course's study material does not contain extracted text.", 422, "DOCUMENT_TEXT_EMPTY");
    this.name = "StudyAssistantEmptyDocumentError";
  }
}

export class StudyAssistantDatabaseError extends StudyAssistantError {
  constructor() {
    super("Unable to load this study material right now.", 500, "STUDY_ASSISTANT_DATABASE_ERROR");
    this.name = "StudyAssistantDatabaseError";
  }
}

export class StudyAssistantService {
  constructor(private readonly aiService: AIService) {}

  async answerQuestion(input: {
    courseId: string;
    userId: string;
    question: string;
    history: AIConversationMessage[];
  }): Promise<string> {
    let course: HydratedDocument<CourseRecord> | null;
    try {
      course = await Course.findOne({ _id: input.courseId, userId: input.userId })
        .select("title description topics userId documentId");
    } catch {
      throw new StudyAssistantDatabaseError();
    }
    if (!course) throw new StudyAssistantCourseNotFoundError();

    let document: HydratedDocument<DocumentRecord> | null;
    try {
      document = await Document.findOne({ _id: course.documentId, userId: input.userId })
        .select("extractedText userId");
    } catch {
      throw new StudyAssistantDatabaseError();
    }
    if (!document) throw new StudyAssistantDocumentNotFoundError();
    if (!document.extractedText?.trim()) throw new StudyAssistantEmptyDocumentError();

    return this.aiService.answerQuestion({
      instructions: buildStudyAssistantInstructions(),
      materialText: document.extractedText,
      courseContext: {
        title: course.title,
        description: course.description,
        topicTitles: course.topics.map((topic) => topic.title),
      },
      question: input.question,
      history: input.history,
    });
  }
}
