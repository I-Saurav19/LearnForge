"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const maxFileSizeBytes = 10 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "docx", "ppt", "pptx", "txt", "csv"]);
const acceptedFileTypes = ".pdf,.docx,.ppt,.pptx,.txt,.csv";

interface UploadedDocument {
  id: string;
  filename: string;
  fileType: string;
}

function validateFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!acceptedExtensions.has(extension)) return "Choose a PDF, DOCX, PPT, PPTX, TXT, or CSV file.";
  if (file.size > maxFileSizeBytes) return "This file is too large. Maximum file size is 10 MB.";
  return null;
}

function formatFileSize(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedDocument | null>(null);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  const chooseFile = useCallback((selected: File | undefined) => {
    setUploaded(null);
    setError("");
    if (!selected) return;
    const validation = validateFile(selected);
    if (validation) {
      setFile(null);
      setError(validation);
      return;
    }
    setFile(selected);
  }, []);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function uploadFile() {
    if (!file) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await apiRequest<{ document: UploadedDocument }>("/documents/upload", { method: "POST", body: formData });
      setUploaded(result.document);
      setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload your file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-[#718078]">Loading your learning space…</main>;

  return <main className="min-h-screen px-5 py-8 sm:px-8"><header className="mx-auto flex max-w-3xl items-center justify-between"><Link href="/dashboard" className="text-sm font-semibold text-[#47715d]">← Back to dashboard</Link><span className="text-sm font-semibold">LearnForge <span className="text-[#668071]">AI</span></span></header><section className="mx-auto mt-14 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Your learning space</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Upload your study material</h1><p className="mt-3 leading-7 text-[#64716a]">Add a document you’d like to keep with your learning materials.</p>
    <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={onDrop} className={`mt-8 rounded-3xl border-2 border-dashed p-8 text-center transition sm:p-12 ${dragging ? "border-[#38795d] bg-[#edf5ed]" : "border-[#d5dfd6] bg-white"}`}>
      <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eff5ee] text-2xl text-[#39765b]">↑</span><p className="mt-5 text-lg font-semibold">Drag and drop a file</p><p className="mt-2 text-sm text-[#718078]">or</p><label htmlFor="study-file" className="mt-4 inline-flex cursor-pointer rounded-full border border-[#cfdacf] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#f6f8f5]">Choose file</label><input ref={inputRef} id="study-file" className="sr-only" type="file" accept={acceptedFileTypes} onChange={onFileChange} />
      <p className="mt-5 text-xs text-[#7c8981]">Supported: PDF, DOCX, PPT, PPTX, TXT, CSV · Up to 10 MB</p>
    </div>
    {file && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#e2e8e1] bg-white p-4"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff5ee] text-xs font-bold uppercase text-[#39765b]">{file.name.split(".").pop()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="mt-1 block text-xs text-[#7c8981]">{formatFileSize(file.size)}</span></span><button type="button" onClick={() => { setFile(null); setError(""); }} className="px-2 py-1 text-sm text-[#718078]" aria-label="Remove selected file">Remove</button></div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {uploaded && <div role="status" className="mt-5 rounded-2xl border border-[#cfe2d1] bg-[#eef7ef] p-5"><p className="font-semibold text-[#285b3e]">Upload complete</p><p className="mt-1 text-sm text-[#54715d]">{uploaded.filename} is ready in your documents.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/dashboard" className="rounded-full bg-[#205c48] px-4 py-2.5 text-sm font-semibold text-white">Continue to dashboard</Link><button type="button" onClick={() => { setUploaded(null); inputRef.current?.click(); }} className="rounded-full border border-[#bfd1c2] px-4 py-2.5 text-sm font-semibold text-[#285b3e]">Upload another document</button></div></div>}
    {!uploaded && <button type="button" disabled={!file || uploading} onClick={() => void uploadFile()} className="mt-6 w-full rounded-xl bg-[#205c48] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#174a39] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{uploading ? "Uploading…" : "Upload"}</button>}
  </section></main>;
}
