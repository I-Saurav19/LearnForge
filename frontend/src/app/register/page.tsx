"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && user) router.replace("/dashboard"); }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await register({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) });
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-md rounded-3xl border border-[#e2e8e1] bg-white p-8 shadow-[0_25px_80px_-45px_rgba(31,72,53,.35)] sm:p-10">
    <Link href="/" className="text-sm font-semibold text-[#47715d]">← LearnForge AI</Link>
    <p className="mt-9 text-xs font-semibold uppercase tracking-[.17em] text-[#659078]">Start your learning journey</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
    <p className="mt-3 text-sm leading-6 text-[#718078]">Your own space to make study time count.</p>
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">Name<input className="mt-2 w-full rounded-xl border border-[#dce4dc] px-4 py-3 outline-none focus:border-[#498068]" name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required /></label>
      <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border border-[#dce4dc] px-4 py-3 outline-none focus:border-[#498068]" name="email" type="email" autoComplete="email" required /></label>
      <label className="block text-sm font-medium">Password<input className="mt-2 w-full rounded-xl border border-[#dce4dc] px-4 py-3 outline-none focus:border-[#498068]" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /><span className="mt-1 block text-xs font-normal text-[#718078]">Use at least 8 characters, including a letter and a number.</span></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={submitting} className="w-full rounded-xl bg-[#205c48] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#174a39] disabled:opacity-60">{submitting ? "Creating account…" : "Create account"}</button>
    </form>
    <p className="mt-6 text-center text-sm text-[#718078]">Already have an account? <Link className="font-semibold text-[#38795d]" href="/login">Sign in</Link></p>
  </section></main>;
}
