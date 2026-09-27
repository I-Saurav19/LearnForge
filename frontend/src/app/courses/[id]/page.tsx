"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCourse, type Course } from "@/lib/courses";
import { generateQuiz } from "@/lib/courses";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quizMenuOpen, setQuizMenuOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const quizMenuRef = useRef<HTMLDivElement>(null);
  const generateQuizButtonRef = useRef<HTMLButtonElement>(null);
  const quizRequestInFlight = useRef(false);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    void getCourse(id)
      .then((result) => { if (active) setCourse(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this course."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, id]);

  useEffect(() => {
    if (!quizMenuOpen) return;

    function closeMenuOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !quizMenuRef.current?.contains(event.target)) {
        setQuizMenuOpen(false);
      }
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQuizMenuOpen(false);
        generateQuizButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [quizMenuOpen]);

  async function handleGenerateQuiz(questionCount: 5 | 10 | 15) {
    if (!course || quizRequestInFlight.current) return;
    quizRequestInFlight.current = true;
    setQuizLoading(true);
    setQuizError("");
    setQuizMenuOpen(false);
    try {
      const quiz = await generateQuiz(course.id, questionCount);
      router.push(`/courses/${course.id}/quiz/${quiz.id}`);
    } catch (cause) {
      setQuizError(cause instanceof Error ? cause.message : "Unable to generate your quiz. Please try again.");
    } finally {
      quizRequestInFlight.current = false;
      setQuizLoading(false);
    }
  }

  if (authLoading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your course…</main>;
  if (error || !course) return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/courses" className="text-sm font-semibold text-[#47715d]">← My courses</Link><div className="mt-12 rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Course not found</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">{error || "This course may have been removed or may not belong to your account."}</p></div></div></main>;

  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/courses" className="text-sm font-semibold text-[#47715d]">← My courses</Link><Link href="/dashboard" className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></Link></header><article className="mx-auto mt-12 max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Your course · {course.topics.length} {course.topics.length === 1 ? "topic" : "topics"}</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{course.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#64716a]">{course.description}</p><div className="mt-8 flex flex-col items-start gap-3"><Link href={`/courses/${course.id}/ask`} className="inline-flex h-11 w-48 items-center justify-center rounded-full bg-[#286345] px-5 text-sm font-semibold text-white transition hover:bg-[#1f5138]">Ask AI</Link><div className="relative w-48" ref={quizMenuRef}><button ref={generateQuizButtonRef} type="button" aria-haspopup="menu" aria-expanded={quizMenuOpen} aria-controls="quiz-question-count-menu" onClick={() => setQuizMenuOpen((open) => !open)} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#286345] px-5 text-sm font-semibold text-white transition hover:bg-[#1f5138] disabled:cursor-wait disabled:opacity-70" disabled={quizLoading}>{quizLoading ? "Generating your quiz…" : "Generate Quiz"}</button>{quizMenuOpen && !quizLoading && <div id="quiz-question-count-menu" role="menu" aria-label="Number of Questions" className="absolute left-0 top-full z-10 mt-2 w-56 rounded-2xl border border-[#d8dfd9] bg-white p-3 shadow-lg"><p className="px-3 pb-2 text-sm font-semibold text-[#202a24]">Number of Questions</p>{([5, 10, 15] as const).map((count) => <button key={count} type="button" role="menuitem" onClick={() => void handleGenerateQuiz(count)} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#526158] transition hover:bg-[#eff5ee] hover:text-[#204f38] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#286345]">{count} Questions</button>)}</div>}</div>{quizError && <p role="alert" className="max-w-sm text-sm text-[#a1442a]">{quizError}</p>}</div><section className="mt-10"><h2 className="text-xl font-semibold">Course topics</h2>{course.topics.length === 0 ? <p className="mt-4 rounded-2xl bg-white p-6 text-sm text-[#718078]">This course has no topics yet.</p> : <ol className="mt-5 space-y-3">{course.topics.map((topic, index) => <li key={topic.id || `${topic.title}-${index}`}><Link href={`/courses/${course.id}/topics/${topic.id || `topic-${index}`}`} className="flex items-center gap-4 rounded-2xl border border-[#e2e8e1] bg-white p-5 transition hover:border-[#b9ccbd]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eff5ee] text-sm font-semibold text-[#39765b]">{index + 1}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{topic.title}</span><span className="mt-1 block line-clamp-2 text-sm leading-6 text-[#718078]">{topic.explanation}</span></span><span aria-hidden="true" className="text-[#668071]">→</span></Link></li>)}</ol>}</section></article></main>;
}
