import { Schema, model, type Types } from "mongoose";

export interface QuizQuestionRecord {
  _id?: Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizRecord {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  questions: QuizQuestionRecord[];
  createdAt: Date;
}

const quizQuestionSchema = new Schema<QuizQuestionRecord>({
  question: { type: String, required: true, trim: true },
  options: { type: [String], required: true, validate: (options: string[]) => options.length === 4 },
  correctAnswer: { type: String, required: true, trim: true },
  explanation: { type: String, required: true, trim: true },
}, { _id: true, strict: "throw" });

quizQuestionSchema.pre("validate", function validateQuestion() {
  if (this.options.length !== 4 || new Set(this.options.map((option) => option.trim().toLocaleLowerCase())).size !== 4) {
    this.invalidate("options", "A quiz question requires four distinct options.");
  }
  if (!this.options.includes(this.correctAnswer)) {
    this.invalidate("correctAnswer", "The correct answer must be one of the options.");
  }
});

const quizSchema = new Schema<QuizRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  questions: { type: [quizQuestionSchema], required: true, validate: (questions: QuizQuestionRecord[]) => questions.length > 0 },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false, strict: "throw" });

quizSchema.index({ userId: 1, createdAt: -1 });

export const Quiz = model<QuizRecord>("Quiz", quizSchema);
