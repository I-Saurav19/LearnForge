import { Schema, model, type Types } from "mongoose";

export interface CourseTopicRecord {
  _id?: Types.ObjectId;
  title: string;
  explanation: string;
  importantConcepts: string[];
  examples: string[];
  keyPoints: string[];
}

export interface CourseRecord {
  userId: Types.ObjectId;
  documentId: Types.ObjectId;
  title: string;
  description: string;
  topics: CourseTopicRecord[];
  createdAt: Date;
}

const courseTopicSchema = new Schema<CourseTopicRecord>({
  title: { type: String, required: true, trim: true },
  explanation: { type: String, required: true, trim: true },
  importantConcepts: { type: [String], required: true, default: [] },
  examples: { type: [String], required: true, default: [] },
  keyPoints: { type: [String], required: true, default: [] },
});

const courseSchema = new Schema<CourseRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    topics: { type: [courseTopicSchema], required: true, default: [] },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

courseSchema.index({ userId: 1, documentId: 1 }, { unique: true });
courseSchema.index({ userId: 1, createdAt: -1 });

export const Course = model<CourseRecord>("Course", courseSchema);
