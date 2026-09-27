"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getCourse, type Course } from "@/lib/courses";

type Message = { role: "user" | "assistant"; content: string };
const recentHistoryLimit = 12;

export default function AskCoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    void getCourse(id)
      .then((result) => { if (active) setCourse(result); })
      .catch((cause: unknown) => { if (active) setPageError(cause instanceof Error ? cause.message : "Unable to load this course."); })
      .finally(() => { if (active) setPageLoading(false); });
    return () => { active = false; };
  }, [user, id]);

  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || busy) return;
    const priorMessages = messages;
    setMessages((current) => [...current, { role: "user", content: submittedQuestion }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest<{ answer: string }>("/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id, question: submittedQuestion, history: priorMessages.slice(-recentHistoryLimit) }),
      });
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to get an answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;
  if (pageLoading) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your course…</main>;
  if (!course) return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/courses" className="text-sm font-semibold text-[#47715d]">← My courses</Link><section className="mt-12 rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Course not found</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">{pageError || "This course may have been removed or may not belong to your account."}</p></section></div></main>;

  return <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
    <header className="mx-auto flex max-w-4xl items-center justify-between"><Link href={`/courses/${course.id}`} className="text-sm font-semibold text-[#47715d]">← Back to course</Link><Link href="/dashboard" className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></Link></header>
    <section className="mx-auto mt-8 flex min-h-[calc(100vh-9rem)] max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#e2e8e1] bg-white shadow-sm">
      <div className="border-b border-[#e9ede9] px-5 py-5 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#47715d]">Study assistant</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Ask about your study material</h1><p className="mt-1 text-sm text-[#718078]">{course.title}</p></div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && !busy && <div className="grid min-h-64 place-items-center text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eff5ee] text-xl text-[#39765b]" aria-hidden="true">✦</div><h2 className="mt-4 font-semibold">What would you like to understand?</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#718078]">Ask a question about this course. Answers are grounded in the study material used to create it.</p></div></div>}
        {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${message.role === "user" ? "rounded-br-md bg-[#286345] text-white" : "rounded-bl-md bg-[#f2f5f1] text-[#26362d]"}`}><p className="whitespace-pre-wrap">{message.content}</p></div></div>)}
        {busy && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-[#f2f5f1] px-4 py-3 text-sm text-[#718078]">Thinking through your study material…</div></div>}
        <div ref={conversationEnd} />
      </div>
      <div className="border-t border-[#e9ede9] px-4 py-4 sm:px-8">
        {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff2ed] px-4 py-3 text-sm text-[#a1442a]">{error}</p>}
        <form onSubmit={submitQuestion} className="flex items-end gap-3"><label htmlFor="study-question" className="sr-only">Your question</label><textarea id="study-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={4000} rows={2} placeholder="Ask a question about your material…" disabled={busy} className="min-h-12 flex-1 resize-y rounded-2xl border border-[#dce4dc] bg-[#fcfdfb] px-4 py-3 text-sm outline-none transition placeholder:text-[#96a198] focus:border-[#6e9a7c] focus:ring-2 focus:ring-[#dcebdd] disabled:opacity-60"/><button type="submit" disabled={busy || !question.trim()} className="rounded-full bg-[#286345] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f5138] disabled:cursor-not-allowed disabled:bg-[#a9b9ae]">{busy ? "Asking…" : "Ask"}</button></form>
        <p className="mt-2 text-xs text-[#87928a]">Answers are based on your uploaded study material. Press Enter to ask, Shift+Enter for a new line.</p>
      </div>
    </section>
  </main>;
}
