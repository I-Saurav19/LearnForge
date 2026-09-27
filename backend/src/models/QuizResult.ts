import { Schema, model, type Types } from "mongoose";

export interface QuizResultAnswerRecord {
  questionId: Types.ObjectId;
  selectedAnswer: string;
  isCorrect: boolean;
}

export interface QuizResultRecord {
  userId: Types.ObjectId;
  quizId: Types.ObjectId;
  score: number;
  totalQuestions: number;
  answers: QuizResultAnswerRecord[];
  createdAt: Date;
}

const resultAnswerSchema = new Schema<QuizResultAnswerRecord>({
  questionId: { type: Schema.Types.ObjectId, required: true },
  selectedAnswer: { type: String, required: true, trim: true },
  isCorrect: { type: Boolean, required: true },
}, { _id: false, strict: "throw" });

const quizResultSchema = new Schema<QuizResultRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
  score: { type: Number, required: true, min: 0, validate: Number.isInteger },
  totalQuestions: { type: Number, required: true, min: 1, validate: Number.isInteger },
  answers: { type: [resultAnswerSchema], required: true, validate: (answers: QuizResultAnswerRecord[]) => answers.length > 0 },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false, strict: "throw" });

quizResultSchema.index({ userId: 1, createdAt: -1 });

quizResultSchema.pre("validate", function validateResult() {
  if (this.score > this.totalQuestions) this.invalidate("score", "Score cannot exceed the number of questions.");
  if (this.answers.length !== this.totalQuestions) this.invalidate("answers", "A result must include one answer per question.");
  if (this.answers.reduce((total, answer) => total + Number(answer.isCorrect), 0) !== this.score) {
    this.invalidate("score", "Score must match the correct submitted answers.");
  }
});

export const QuizResult = model<QuizResultRecord>("QuizResult", quizResultSchema);
