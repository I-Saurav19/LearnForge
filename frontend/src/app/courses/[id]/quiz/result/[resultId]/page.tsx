"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { generateQuiz, getCourse, getQuizResult, type Course, type QuizReview } from "@/lib/courses";

export default function QuizResultPage() {
  const { id, resultId } = useParams<{ id: string; resultId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [result, setResult] = useState<QuizReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => {
    if (!user || !id || !resultId) return;
    let active = true;
    void Promise.all([getCourse(id), getQuizResult(resultId)])
      .then(([loadedCourse, loadedResult]) => {
        if (!active) return;
        if (loadedResult.courseId !== loadedCourse.id) {
          setError("This result does not belong to the selected course.");
          return;
        }
        setCourse(loadedCourse);
        setResult(loadedResult);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this quiz result."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, id, resultId]);

  async function handleTryAgain() {
    if (!course || !result || retrying) return;
    setRetrying(true);
    setError("");
    try {
      const nextQuiz = await generateQuiz(course.id, result.totalQuestions as 5 | 10 | 15);
      router.push(`/courses/${course.id}/quiz/${nextQuiz.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create another quiz. Please try again.");
      setRetrying(false);
    }
  }

  if (authLoading || !user || loading) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">{authLoading || !user ? "Loading your learning space…" : "Loading your result…"}</main>;
  if (error && (!course || !result)) return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href={`/courses/${id}`} className="text-sm font-semibold text-[#47715d]">← Back to course</Link><section className="mt-12 rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Result unavailable</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">{error}</p></section></div></main>;
  if (!course || !result) return null;

  const wrongAnswers = result.totalQuestions - result.score;
  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto flex max-w-4xl items-center justify-between"><Link href={`/courses/${course.id}`} className="text-sm font-semibold text-[#47715d]">← Back to course</Link><Link href="/dashboard" className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></Link></header><article className="mx-auto mt-8 max-w-4xl"><section className="rounded-3xl border border-[#e2e8e1] bg-white px-6 py-8 text-center shadow-sm sm:px-10"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Quiz Completed!</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{course.title}</h1><p className="mt-5 text-lg font-semibold">Score: {result.score} / {result.totalQuestions}</p><p className="mt-1 text-4xl font-semibold tracking-tight text-[#286345]">{result.percentage}%</p><div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-sm"><p className="rounded-xl bg-[#eff6ef] px-4 py-3"><span className="block font-semibold">Correct Answers: {result.score}</span><span className="text-[#526158]">Correct</span></p><p className="rounded-xl bg-[#f5f3f0] px-4 py-3"><span className="block font-semibold">Wrong Answers: {wrongAnswers}</span><span className="text-[#526158]">Incorrect</span></p></div><div className="mt-7 flex flex-wrap justify-center gap-3"><a href="#answer-review" className="rounded-full bg-[#286345] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f5138]">Review Answers</a><button type="button" onClick={() => void handleTryAgain()} disabled={retrying} className="rounded-full border border-[#d8dfd9] px-5 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">{retrying ? "Generating another quiz…" : "Try Again"}</button><Link href={`/courses/${course.id}`} className="rounded-full border border-[#d8dfd9] px-5 py-2.5 text-sm font-semibold">Back to Course</Link></div>{error && <p role="alert" className="mt-4 text-sm text-[#a1442a]">{error}</p>}</section><section id="answer-review" className="mt-10 scroll-mt-8"><h2 className="text-2xl font-semibold">Review Answers</h2><ol className="mt-5 space-y-4">{result.answers.map((answer, index) => <li key={answer.questionId} className={`rounded-2xl border bg-white p-5 sm:p-6 ${answer.isCorrect ? "border-[#9cbea2]" : "border-[#d7b1a6]"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-[#47715d]">Question {index + 1}</p><p className="rounded-full bg-[#f2f5f1] px-3 py-1 text-xs font-semibold">{answer.isCorrect ? "Correct answer" : "Incorrect answer"}</p></div><h3 className="mt-2 text-lg font-semibold leading-7">{answer.question}</h3><dl className="mt-4 space-y-3 text-sm leading-6"><div><dt className="font-semibold text-[#526158]">Your answer</dt><dd className="text-[#26362d]">{answer.selectedAnswer || "No answer submitted"}</dd></div><div><dt className="font-semibold text-[#526158]">Correct answer</dt><dd className="text-[#26362d]">{answer.correctAnswer}</dd></div><div><dt className="font-semibold text-[#526158]">Explanation</dt><dd className="text-[#526158]">{answer.explanation}</dd></div></dl></li>)}</ol></section></article></main>;
}
