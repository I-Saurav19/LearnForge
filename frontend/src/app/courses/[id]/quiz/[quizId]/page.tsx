"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCourse, getQuiz, submitQuiz, type Course, type QuizView } from "@/lib/courses";

export default function QuizPage() {
  const { id, quizId } = useParams<{ id: string; quizId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => {
    if (!user || !id || !quizId) return;
    let active = true;
    void Promise.all([getCourse(id), getQuiz(quizId)])
      .then(([loadedCourse, loadedQuiz]) => {
        if (!active) return;
        if (loadedQuiz.courseId !== loadedCourse.id) {
          setError("This quiz does not belong to the selected course.");
          return;
        }
        setCourse(loadedCourse);
        setQuiz(loadedQuiz);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this quiz."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, id, quizId]);

  async function handleSubmit() {
    if (!quiz || submitting) return;
    const firstUnanswered = quiz.questions.findIndex((question) => !selectedAnswers[question.id]);
    if (firstUnanswered !== -1) {
      setQuestionIndex(firstUnanswered);
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await submitQuiz(quiz.id, quiz.questions.map((question) => ({
        questionId: question.id,
        selectedAnswer: selectedAnswers[question.id]!,
      })));
      router.push(`/courses/${course?.id ?? id}/quiz/result/${result.resultId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your quiz. Please try again.");
      setSubmitting(false);
    }
  }

  if (authLoading || !user || loading) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">{authLoading || !user ? "Loading your learning space…" : "Loading your quiz…"}</main>;
  if (error && (!course || !quiz)) return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href={`/courses/${id}`} className="text-sm font-semibold text-[#47715d]">← Back to course</Link><section className="mt-12 rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Quiz unavailable</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">{error}</p></section></div></main>;
  if (!course || !quiz || quiz.questions.length === 0) return <main className="min-h-screen px-5 py-8 sm:px-8"><section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Quiz unavailable</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">This quiz has no questions.</p></section></main>;

  const question = quiz.questions[questionIndex]!;
  const isLastQuestion = questionIndex === quiz.questions.length - 1;

  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto flex max-w-3xl items-center justify-between"><Link href={`/courses/${course.id}`} className="text-sm font-semibold text-[#47715d]">← Back to course</Link><Link href="/dashboard" className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></Link></header><article className="mx-auto mt-10 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Practice quiz</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1><section className="mt-7 rounded-3xl border border-[#e2e8e1] bg-white p-5 shadow-sm sm:p-8"><div className="flex items-center justify-between gap-4"><p className="text-sm font-semibold text-[#47715d]">Question {questionIndex + 1} of {quiz.questions.length}</p><div className="h-2 w-32 overflow-hidden rounded-full bg-[#e9eee9]" role="progressbar" aria-label="Quiz progress" aria-valuemin={1} aria-valuemax={quiz.questions.length} aria-valuenow={questionIndex + 1}><div className="h-full rounded-full bg-[#4c8461]" style={{ width: `${((questionIndex + 1) / quiz.questions.length) * 100}%` }} /></div></div><h2 className="mt-5 text-xl font-semibold leading-8">{question.question}</h2><fieldset className="mt-5 space-y-3" disabled={submitting}><legend className="sr-only">Choose one answer</legend>{question.options.map((option, optionIndex) => <label key={`${question.id}-${optionIndex}`} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 transition ${selectedAnswers[question.id] === option ? "border-[#6f9c7d] bg-[#f0f6f0]" : "border-[#e5eae5] hover:border-[#b9ccbd]"}`}><input type="radio" name={question.id} value={option} checked={selectedAnswers[question.id] === option} onChange={() => { setSelectedAnswers((current) => ({ ...current, [question.id]: option })); setError(""); }} className="mt-1 accent-[#286345]" />{option}</label>)}</fieldset>{error && <p role="alert" className="mt-4 rounded-xl bg-[#fff2ed] px-4 py-3 text-sm text-[#a1442a]">{error}</p>}<div className="mt-7 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => { setQuestionIndex((current) => Math.max(0, current - 1)); setError(""); }} disabled={questionIndex === 0 || submitting} className="rounded-full border border-[#d8dfd9] px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45">Previous</button>{isLastQuestion ? <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="rounded-full bg-[#286345] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f5138] disabled:cursor-wait disabled:opacity-70">{submitting ? "Submitting…" : "Submit Quiz"}</button> : <button type="button" onClick={() => { setQuestionIndex((current) => Math.min(quiz.questions.length - 1, current + 1)); setError(""); }} disabled={submitting} className="rounded-full bg-[#286345] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f5138] disabled:cursor-not-allowed">Next</button>}</div></section><p className="mt-4 text-center text-xs text-[#87928a]">Your answers are checked after you submit.</p></article></main>;
}
