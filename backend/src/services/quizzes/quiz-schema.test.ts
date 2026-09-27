import { describe, expect, it } from "vitest";
import { createQuizSchema } from "./quiz-schema.js";

function questions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    options: ["First", "Second", "Third", "Fourth"],
    correctAnswer: "First",
    explanation: "The material supports this answer.",
  }));
}

describe("generated quiz validation", () => {
  it("accepts exactly the requested count with valid four-option questions", () => {
    expect(createQuizSchema(5).safeParse({ questions: questions(5) }).success).toBe(true);
    expect(createQuizSchema(5).safeParse({ questions: questions(4) }).success).toBe(false);
  });

  it("rejects a correct answer outside the options and duplicate options", () => {
    const invalidAnswer = questions(5);
    invalidAnswer[0]!.correctAnswer = "Not an option";
    expect(createQuizSchema(5).safeParse({ questions: invalidAnswer }).success).toBe(false);

    const duplicateOptions = questions(5);
    duplicateOptions[0]!.options = ["First", " First ", "Third", "Fourth"];
    expect(createQuizSchema(5).safeParse({ questions: duplicateOptions }).success).toBe(false);
  });

  it("rejects duplicate questions, empty content, and unexpected fields", () => {
    const duplicates = questions(5);
    duplicates[1]!.question = "  QUESTION   1? ";
    expect(createQuizSchema(5).safeParse({ questions: duplicates }).success).toBe(false);
    const empty = questions(5);
    empty[0]!.explanation = " ";
    expect(createQuizSchema(5).safeParse({ questions: empty }).success).toBe(false);
    expect(createQuizSchema(5).safeParse({ questions: questions(5), title: "Unexpected" }).success).toBe(false);
  });
});
