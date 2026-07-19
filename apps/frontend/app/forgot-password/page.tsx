"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/auth.actions";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await requestPasswordResetAction(formData);
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      setSent(true);
      setIsLoading(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 font-sans text-[var(--text-primary)]">
      <Link
        href="/login"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        <ArrowLeft size={14} /> Back to login
      </Link>

      <div className="w-full max-w-[400px] rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-surface)] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Forgot Password
          </h1>
          <p className="text-xs font-medium text-[var(--text-primary)]/60 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            We'll send you a reset link
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-[#E55345]/10 border border-[#E55345]/30 p-4 text-center text-sm font-semibold text-[#E55345] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed">
              If an account exists for that email, a reset link is on its way. Check your inbox
              (and spam folder) — the link expires in 30 minutes.
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 text-sm font-semibold text-[#E55345] hover:text-[#E55345]/80 underline underline-offset-4 transition-colors"
            >
              Return to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
              <input
                name="email"
                type="email"
                placeholder="Email address"
                disabled={isLoading}
                required
                className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center rounded-sm bg-[#F1EEE3] py-3.5 font-semibold text-[#0D1527] hover:bg-[#E2DDD0] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
