import { Types, type HydratedDocument } from "mongoose";
import type { AIService } from "../ai/index.js";
import { Course, type CourseRecord } from "../../models/Course.js";
import { Document, type DocumentRecord } from "../../models/Document.js";
import { Quiz } from "../../models/Quiz.js";
import { buildQuizInstructions } from "../ai/quiz-prompt.js";
import { createQuizSchema } from "./quiz-schema.js";

export class QuizServiceError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "QuizServiceError";
  }
}

export class QuizCourseNotFoundError extends QuizServiceError {
  constructor() { super("Course not found.", 404, "COURSE_NOT_FOUND"); this.name = "QuizCourseNotFoundError"; }
}

export class QuizDocumentNotFoundError extends QuizServiceError {
  constructor() { super("The study material for this course could not be found.", 404, "DOCUMENT_NOT_FOUND"); this.name = "QuizDocumentNotFoundError"; }
}

export class QuizSourceTextEmptyError extends QuizServiceError {
  constructor() { super("This course's study material does not contain extracted text.", 422, "DOCUMENT_TEXT_EMPTY"); this.name = "QuizSourceTextEmptyError"; }
}

export class QuizPersistenceError extends QuizServiceError {
  constructor() { super("Unable to save or load quizzes right now.", 500, "QUIZ_DATABASE_ERROR"); this.name = "QuizPersistenceError"; }
}

export const supportedQuestionCounts = [5, 10, 15] as const;
export type SupportedQuestionCount = (typeof supportedQuestionCounts)[number];

export class QuizService {
  constructor(private readonly aiService: AIService) {}

  async generateForCourse(courseId: string, userId: string, questionCount: SupportedQuestionCount): Promise<InstanceType<typeof Quiz>> {
    let course: HydratedDocument<CourseRecord> | null;
    try {
      course = await Course.findOne({ _id: courseId, userId }).select("title description topics documentId userId");
    } catch {
      throw new QuizPersistenceError();
    }
    if (!course) throw new QuizCourseNotFoundError();

    let document: HydratedDocument<DocumentRecord> | null;
    try {
      document = await Document.findOne({ _id: course.documentId, userId }).select("extractedText userId");
    } catch {
      throw new QuizPersistenceError();
    }
    if (!document) throw new QuizDocumentNotFoundError();
    if (!document.extractedText?.trim()) throw new QuizSourceTextEmptyError();

    const content = await this.aiService.generateQuiz({
      materialText: document.extractedText,
      instructions: buildQuizInstructions(questionCount),
      courseContext: {
        title: course.title,
        description: course.description,
        topicTitles: course.topics.map((topic) => topic.title),
      },
      questionCount,
      outputSchema: createQuizSchema(questionCount),
    });

    const quiz = new Quiz({
      userId: new Types.ObjectId(userId),
      courseId: new Types.ObjectId(courseId),
      questions: content.questions,
    });
    try {
      await quiz.save();
      return quiz;
    } catch {
      throw new QuizPersistenceError();
    }
  }
}
