import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const courseTopicSchema = z.object({
  title: nonEmptyText,
  explanation: nonEmptyText,
  importantConcepts: z.array(nonEmptyText),
  examples: z.array(nonEmptyText),
  keyPoints: z.array(nonEmptyText),
}).strict();

export const generatedCourseSchema = z.object({
  title: nonEmptyText,
  description: nonEmptyText,
  topics: z.array(courseTopicSchema).min(1),
}).strict();

export type CourseTopicContent = z.infer<typeof courseTopicSchema>;
export type GeneratedCourseContent = z.infer<typeof generatedCourseSchema>;
