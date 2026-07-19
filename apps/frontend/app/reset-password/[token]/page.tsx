"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { resetPasswordAction } from "@/lib/auth.actions";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await resetPasswordAction(token, formData);
      if (result && "error" in result) {
        setError(result.error ?? "This reset link is invalid or has expired.");
        setIsLoading(false);
        return;
      }
      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 font-sans text-[var(--text-primary)]">
      <div className="w-full max-w-[400px] rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-surface)] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Set New Password
          </h1>
          <p className="text-xs font-medium text-[var(--text-primary)]/60 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            Choose a strong password
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-[#E55345]/10 border border-[#E55345]/30 p-4 text-center text-sm font-semibold text-[#E55345] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed">
              Password updated. Redirecting you to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
              <input
                name="newPassword"
                type={showNew ? "text" : "password"}
                placeholder="New password"
                disabled={isLoading}
                required
                minLength={6}
                className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 pl-11 pr-11 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                disabled={isLoading}
                className="absolute right-4 top-3.5 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
              <input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                disabled={isLoading}
                required
                minLength={6}
                className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 pl-11 pr-11 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                disabled={isLoading}
                className="absolute right-4 top-3.5 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center rounded-sm bg-[#F1EEE3] py-3.5 font-semibold text-[#0D1527] hover:bg-[#E2DDD0] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  Saving...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--text-primary)]/60">
          <Link href="/login" className="text-[#E55345] hover:text-[#E55345]/80 font-semibold underline underline-offset-4 transition-colors">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
