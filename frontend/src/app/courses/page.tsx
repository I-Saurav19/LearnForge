"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listCourses, type CourseSummary } from "@/lib/courses";

export default function CoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !user) router.replace("/login"); }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void listCourses()
      .then((items) => { if (active) setCourses(items); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load your courses."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  if (authLoading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;

  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto flex max-w-4xl items-center justify-between"><Link href="/dashboard" className="text-sm font-semibold text-[#47715d]">← Dashboard</Link><span className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></span></header><section className="mx-auto mt-14 max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Your learning space</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em]">My courses</h1><p className="mt-3 leading-7 text-[#64716a]">Courses created from your study material.</p>{loading ? <p className="mt-8 rounded-2xl bg-white p-6 text-sm text-[#718078]">Loading your courses…</p> : error ? <p role="alert" className="mt-8 rounded-2xl bg-red-50 p-6 text-sm text-red-800">{error}</p> : courses.length === 0 ? <div className="mt-8 rounded-3xl border border-[#e2e8e1] bg-white px-6 py-12 text-center"><h2 className="text-lg font-semibold">No courses yet</h2><p className="mt-2 text-sm text-[#718078]">Choose one of your uploaded documents to create your first course.</p><Link href="/dashboard" className="mt-5 inline-flex rounded-full bg-[#205c48] px-5 py-3 text-sm font-semibold text-white">Choose study material</Link></div> : <ul className="mt-8 grid gap-4 sm:grid-cols-2">{courses.map((course) => <li key={course.id}><Link href={`/courses/${course.id}`} className="block h-full rounded-3xl border border-[#e2e8e1] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#b9ccbd] hover:shadow-sm"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#47715d]">{course.topicCount} {course.topicCount === 1 ? "topic" : "topics"}</span><h2 className="mt-3 text-xl font-semibold tracking-tight">{course.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#64716a]">{course.description}</p><p className="mt-5 text-xs text-[#87928b]">Created {new Date(course.createdAt).toLocaleDateString()}</p></Link></li>)}</ul>}</section></main>;
}
