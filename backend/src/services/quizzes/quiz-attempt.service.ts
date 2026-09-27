import { Types, type HydratedDocument } from "mongoose";
import { Quiz, type QuizRecord } from "../../models/Quiz.js";
import { QuizResult, type QuizResultRecord } from "../../models/QuizResult.js";
import { QuizServiceError } from "./quiz.service.js";

export class QuizAttemptError extends QuizServiceError {
  constructor(message: string, status: number, code: string) { super(message, status, code); this.name = "QuizAttemptError"; }
}

export class QuizNotFoundError extends QuizAttemptError {
  constructor() { super("Quiz not found.", 404, "QUIZ_NOT_FOUND"); this.name = "QuizNotFoundError"; }
}

export class QuizResultNotFoundError extends QuizAttemptError {
  constructor() { super("Quiz result not found.", 404, "QUIZ_RESULT_NOT_FOUND"); this.name = "QuizResultNotFoundError"; }
}

export class QuizAttemptPersistenceError extends QuizAttemptError {
  constructor() { super("Unable to save or load this quiz result right now.", 500, "QUIZ_RESULT_DATABASE_ERROR"); this.name = "QuizAttemptPersistenceError"; }
}

export interface SubmittedQuizAnswer {
  questionId: string;
  selectedAnswer: string;
}

export class QuizAttemptService {
  async submit(quizId: string, userId: string, submittedAnswers: SubmittedQuizAnswer[]) {
    let quiz: HydratedDocument<QuizRecord> | null;
    try {
      quiz = await Quiz.findOne({ _id: quizId, userId }).select("userId courseId questions");
    } catch {
      throw new QuizAttemptPersistenceError();
    }
    if (!quiz) throw new QuizNotFoundError();

    if (submittedAnswers.length !== quiz.questions.length) {
      throw new QuizAttemptError("Please answer all questions before submitting.", 400, "INCOMPLETE_ANSWERS");
    }
    const questionsById = new Map(quiz.questions.map((question) => [question._id!.toString(), question]));
    const answerByQuestion = new Map<string, string>();
    for (const answer of submittedAnswers) {
      if (answerByQuestion.has(answer.questionId)) {
        throw new QuizAttemptError("Each question can only be answered once.", 400, "DUPLICATE_ANSWER");
      }
      if (!questionsById.has(answer.questionId)) {
        throw new QuizAttemptError("The submission contains a question that does not belong to this quiz.", 400, "UNKNOWN_QUESTION");
      }
      answerByQuestion.set(answer.questionId, answer.selectedAnswer);
    }

    if (answerByQuestion.size !== questionsById.size) {
      throw new QuizAttemptError("Please answer all questions before submitting.", 400, "INCOMPLETE_ANSWERS");
    }
    const resultAnswers = quiz.questions.map((question) => {
      const questionId = question._id!.toString();
      const selectedAnswer = answerByQuestion.get(questionId);
      if (selectedAnswer === undefined) {
        throw new QuizAttemptError("Please answer all questions before submitting.", 400, "INCOMPLETE_ANSWERS");
      }
      if (!question.options.includes(selectedAnswer)) {
        throw new QuizAttemptError("Choose one of the listed options for each question.", 400, "INVALID_SELECTED_ANSWER");
      }
      return {
        questionId: new Types.ObjectId(questionId),
        selectedAnswer,
        isCorrect: selectedAnswer === question.correctAnswer,
      };
    });

    const score = resultAnswers.reduce((sum, answer) => sum + Number(answer.isCorrect), 0);
    const totalQuestions = quiz.questions.length;
    const percentage = Math.floor((score * 10_000 + Math.floor(totalQuestions / 2)) / totalQuestions) / 100;
    const result = new QuizResult({
      userId: new Types.ObjectId(userId),
      quizId: new Types.ObjectId(quizId),
      score,
      totalQuestions,
      answers: resultAnswers,
    });
    try {
      await result.save();
    } catch {
      throw new QuizAttemptPersistenceError();
    }
    return { result, score, totalQuestions, percentage };
  }

  async getReview(resultId: string, userId: string) {
    let result: HydratedDocument<QuizResultRecord> | null;
    try {
      result = await QuizResult.findOne({ _id: resultId, userId }).select("userId quizId score totalQuestions answers createdAt");
    } catch {
      throw new QuizAttemptPersistenceError();
    }
    if (!result) throw new QuizResultNotFoundError();

    let quiz: HydratedDocument<QuizRecord> | null;
    try {
      quiz = await Quiz.findOne({ _id: result.quizId, userId }).select("userId courseId questions");
    } catch {
      throw new QuizAttemptPersistenceError();
    }
    if (!quiz || String(quiz.userId) !== userId) throw new QuizResultNotFoundError();

    const answerByQuestion = new Map(result.answers.map((answer) => [String(answer.questionId), answer]));
    const answers = quiz.questions.map((question) => {
      const questionId = question._id!.toString();
      const submitted = answerByQuestion.get(questionId);
      return {
        questionId,
        question: question.question,
        selectedAnswer: submitted?.selectedAnswer ?? "",
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        isCorrect: submitted?.isCorrect ?? false,
      };
    });
    const percentage = Math.floor((result.score * 10_000 + Math.floor(result.totalQuestions / 2)) / result.totalQuestions) / 100;
    return {
      resultId: result.id,
      quizId: quiz.id,
      courseId: String(quiz.courseId),
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage,
      answers,
    };
  }
}
