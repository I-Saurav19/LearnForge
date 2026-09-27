"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useState } from "react";
import { generateCourse, listCourses, type CourseSummary } from "@/lib/courses";

interface StudyDocument {
  id: string;
  filename: string;
  fileType: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [generatingDocumentId, setGeneratingDocumentId] = useState("");
  const [generationStage, setGenerationStage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void apiRequest<{ documents: StudyDocument[] }>("/documents")
      .then((data) => { if (active) setDocuments(data.documents); })
      .catch((error: unknown) => { if (active) setDocumentsError(error instanceof Error ? error.message : "Unable to load your documents."); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void listCourses()
      .then((items) => { if (active) setCourses(items); })
      .catch((cause: unknown) => { if (active) setCoursesError(cause instanceof Error ? cause.message : "Unable to load your courses."); })
      .finally(() => { if (active) setCoursesLoading(false); });
    return () => { active = false; };
  }, [user]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      router.replace("/login");
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Unable to sign out right now. Please try again.");
      setLoggingOut(false);
    }
  }

  async function handleGenerateCourse(documentId: string) {
    setGeneratingDocumentId(documentId);
    setGenerationError("");
    setGenerationStage("Analyzing your study material…");
    const stageTimer = window.setTimeout(() => setGenerationStage("Creating your course…"), 1400);
    try {
      const course = await generateCourse(documentId);
      router.push(`/courses/${course.id}`);
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : "Unable to generate your course. Please try again.");
    } finally {
      window.clearTimeout(stageTimer);
      setGeneratingDocumentId("");
      setGenerationStage("");
    }
  }

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;

  return <main className="min-h-screen px-6 py-8 md:px-10"><header className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="font-semibold tracking-tight">LearnForge <span className="text-[#668071]">AI</span></Link><nav className="flex items-center gap-4"><Link href="/courses" className="text-sm font-semibold text-[#38795d]">My courses</Link><button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="rounded-full border border-[#d8dfd9] px-5 py-2.5 text-sm font-medium transition hover:bg-white disabled:cursor-wait disabled:opacity-60">{loggingOut ? "Signing out…" : "Sign out"}</button></nav></header>{logoutError && <p role="alert" className="mx-auto mt-4 max-w-5xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{logoutError}</p>}<section className="mx-auto mt-20 max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Your learning space</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Welcome, {user.name}</h1><p className="mt-5 max-w-xl leading-7 text-[#64716a]">Your study dashboard is ready. Select a document to turn your notes into a guided course.</p></div><Link href="/upload" className="rounded-full bg-[#205c48] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#174a39]">Upload study material</Link></div><section className="mt-10 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Recent documents</h2><p className="mt-1 text-sm text-[#718078]">Choose a document to generate a course from its extracted text.</p></div><Link href="/upload" className="text-sm font-semibold text-[#38795d]">Upload another</Link></div>{generationError && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{generationError}</p>}{documentsLoading ? <p className="mt-7 text-sm text-[#718078]">Loading documents…</p> : documentsError ? <p role="alert" className="mt-7 text-sm text-red-700">{documentsError}</p> : documents.length === 0 ? <div className="mt-7 rounded-2xl bg-[#f4f7f2] px-5 py-8 text-center"><p className="font-medium">No study material yet</p><p className="mt-1 text-sm text-[#718078]">Upload a document to see it here.</p><Link href="/upload" className="mt-4 inline-block text-sm font-semibold text-[#38795d]">Upload your first document →</Link></div> : <ul className="mt-6 divide-y divide-[#edf0eb]">{documents.map((document) => { const isGenerating = generatingDocumentId === document.id; return <li key={document.id} className="flex flex-wrap items-center gap-4 py-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff5ee] text-xs font-bold uppercase text-[#39765b]">{document.fileType}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{document.filename}</span><span className="mt-1 block text-xs text-[#87928b]">Uploaded {new Date(document.createdAt).toISOString().slice(0, 10)}</span></span><button type="button" disabled={Boolean(generatingDocumentId)} onClick={() => void handleGenerateCourse(document.id)} className="rounded-full bg-[#205c48] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a39] disabled:cursor-wait disabled:opacity-60">{isGenerating ? generationStage || "Creating your course…" : "Generate Course"}</button></li>; })}</ul>}</section><section className="mt-8 rounded-3xl border border-[#e2e8e1] bg-white p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Recent courses</h2><p className="mt-1 text-sm text-[#718078]">Continue studying your generated lessons.</p></div><Link href="/courses" className="text-sm font-semibold text-[#38795d]">All courses</Link></div>{coursesLoading ? <p className="mt-6 text-sm text-[#718078]">Loading courses…</p> : coursesError ? <p role="alert" className="mt-6 text-sm text-red-700">{coursesError}</p> : courses.length === 0 ? <div className="mt-6 rounded-2xl bg-[#f4f7f2] px-5 py-7 text-center"><p className="font-medium">No courses yet</p><p className="mt-1 text-sm text-[#718078]">Upload study material and generate your first course above.</p></div> : <ul className="mt-5 grid gap-3 sm:grid-cols-2">{courses.slice(0, 4).map((course) => <li key={course.id}><Link href={`/courses/${course.id}`} className="block h-full rounded-2xl border border-[#edf0eb] p-4 transition hover:border-[#b9ccbd]"><span className="text-xs font-semibold text-[#47715d]">{course.topicCount} {course.topicCount === 1 ? "topic" : "topics"}</span><span className="mt-1 block font-semibold">{course.title}</span><span className="mt-1 block line-clamp-2 text-sm leading-6 text-[#718078]">{course.description}</span></Link></li>)}</ul>}</section></section></main>;
}
