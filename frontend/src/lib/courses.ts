import { apiRequest } from "@/lib/api";

export interface CourseTopic {
  id: string;
  title: string;
  explanation: string;
  importantConcepts: string[];
  examples: string[];
  keyPoints: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  topics: CourseTopic[];
  createdAt: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  topicCount: number;
  createdAt: string;
}

export interface QuizQuestionView {
  id: string;
  question: string;
  options: string[];
}

export interface QuizView {
  id: string;
  courseId: string;
  questions: QuizQuestionView[];
}

export interface QuizSubmissionAnswer {
  questionId: string;
  selectedAnswer: string;
}

export interface QuizSubmissionResult {
  resultId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
}

export interface QuizReview {
  resultId: string;
  quizId: string;
  courseId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  answers: Array<{
    questionId: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
  }>;
}

export async function listCourses(): Promise<CourseSummary[]> {
  const result = await apiRequest<{ courses: CourseSummary[] }>("/courses");
  return result.courses;
}

export async function getCourse(courseId: string): Promise<Course> {
  const result = await apiRequest<{ course: Course }>(`/courses/${encodeURIComponent(courseId)}`);
  return result.course;
}

export async function generateCourse(documentId: string): Promise<Course> {
  const result = await apiRequest<{ course: Course; existing: boolean }>("/courses/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  });
  return result.course;
}

export async function generateQuiz(courseId: string, questionCount: 5 | 10 | 15): Promise<{ id: string; courseId: string; questionCount: number }> {
  const result = await apiRequest<{ quiz: { id: string; courseId: string; createdAt: string; questionCount: number } }>("/quizzes/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, questionCount }),
  });
  return result.quiz;
}

export async function getQuiz(quizId: string): Promise<QuizView> {
  const result = await apiRequest<{ quiz: QuizView }>(`/quizzes/${encodeURIComponent(quizId)}`);
  return result.quiz;
}

export async function submitQuiz(quizId: string, answers: QuizSubmissionAnswer[]): Promise<QuizSubmissionResult> {
  const result = await apiRequest<QuizSubmissionResult>(`/quizzes/${encodeURIComponent(quizId)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return result;
}

export async function getQuizResult(resultId: string): Promise<QuizReview> {
  const result = await apiRequest<{ result: QuizReview }>(`/quizzes/results/${encodeURIComponent(resultId)}`);
  return result.result;
}
