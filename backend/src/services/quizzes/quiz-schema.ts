import { z } from "zod";

export const quizQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2_000),
  options: z.array(z.string().trim().min(1).max(500)).length(4),
  correctAnswer: z.string().trim().min(1).max(500),
  explanation: z.string().trim().min(1).max(2_000),
}).strict().superRefine((question, context) => {
  const normalizedOptions = question.options.map((option) => option.toLocaleLowerCase());
  if (new Set(normalizedOptions).size !== question.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Options must be distinct." });
  }
  if (!question.options.includes(question.correctAnswer)) {
    context.addIssue({ code: "custom", path: ["correctAnswer"], message: "The correct answer must be one of the options." });
  }
});

export function createQuizSchema(questionCount: number) {
  return z.object({
    questions: z.array(quizQuestionSchema).length(questionCount),
  }).strict().superRefine((quiz, context) => {
    const normalizedQuestions = quiz.questions.map(({ question }) => question.trim().replace(/\s+/g, " ").toLocaleLowerCase());
    if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
      context.addIssue({ code: "custom", path: ["questions"], message: "Questions must not be duplicated." });
    }
  });
}

export type ValidatedQuiz = z.infer<ReturnType<typeof createQuizSchema>>;
