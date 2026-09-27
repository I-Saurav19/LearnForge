"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCourse, type Course, type CourseTopic } from "@/lib/courses";

export default function TopicPage() {
  const { id, topicId } = useParams<{ id: string; topicId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [topic, setTopic] = useState<CourseTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);
  useEffect(() => {
    if (!user || !id || !topicId) return;
    let active = true;
    void getCourse(id)
      .then((result) => {
        if (!active) return;
        setCourse(result);
        const index = topicId.startsWith("topic-") ? Number(topicId.slice(6)) : -1;
        const selected = result.topics.find((item) => item.id === topicId) ?? (Number.isInteger(index) ? result.topics[index] : undefined);
        if (selected) setTopic(selected);
        else setError("Topic not found in this course.");
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load this topic."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, id, topicId]);

  if (authLoading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your topic…</main>;
  if (error || !course || !topic) return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/courses" className="text-sm font-semibold text-[#47715d]">← My courses</Link><div className="mt-12 rounded-3xl border border-[#e2e8e1] bg-white p-8"><h1 className="text-xl font-semibold">Topic not found</h1><p role="alert" className="mt-2 text-sm leading-6 text-[#64716a]">{error || "This topic may have been removed."}</p></div></div></main>;

  const currentIndex = course.topics.findIndex((item) => item.id === topic.id);
  const previous = currentIndex > 0 ? course.topics[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? course.topics[currentIndex + 1] : null;
  const topicPath = (item: CourseTopic, index: number) => `/courses/${course.id}/topics/${item.id || `topic-${index}`}`;

  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto max-w-3xl"><Link href={`/courses/${course.id}`} className="text-sm font-semibold text-[#47715d]">← {course.title}</Link></header><article className="mx-auto mt-12 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Topic {currentIndex >= 0 ? currentIndex + 1 : ""} of {course.topics.length}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">{topic.title}</h1><section className="mt-8 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">Explanation</h2><p className="mt-4 whitespace-pre-line text-base leading-8 text-[#3f4d45]">{topic.explanation}</p></section><section className="mt-5 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">Important concepts</h2>{topic.importantConcepts.length ? <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-[#3f4d45]">{topic.importantConcepts.map((concept, index) => <li key={`${concept}-${index}`}>{concept}</li>)}</ul> : <p className="mt-3 text-sm text-[#718078]">No key concepts were listed for this topic.</p>}</section><section className="mt-5 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">Examples</h2>{topic.examples.length ? <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-[#3f4d45]">{topic.examples.map((example, index) => <li key={`${example}-${index}`}>{example}</li>)}</ul> : <p className="mt-3 text-sm text-[#718078]">No source-supported examples were available.</p>}</section><section className="mt-5 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">Key points</h2>{topic.keyPoints.length ? <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-[#3f4d45]">{topic.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul> : <p className="mt-3 text-sm text-[#718078]">No key points were listed for this topic.</p>}</section><nav aria-label="Topic navigation" className="mt-8 flex justify-between gap-4">{previous ? <Link href={topicPath(previous, currentIndex - 1)} className="rounded-full border border-[#d8dfd9] px-4 py-2.5 text-sm font-semibold text-[#47715d]">← Previous topic</Link> : <span />}{next && <Link href={topicPath(next, currentIndex + 1)} className="rounded-full bg-[#205c48] px-4 py-2.5 text-sm font-semibold text-white">Next topic →</Link>}</nav></article></main>;
}
