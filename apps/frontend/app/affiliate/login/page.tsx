// FILE: apps/frontend/app/affiliate/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { loginAffiliateAction } from "@/lib/affiliate.actions";

export default function AffiliateLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await loginAffiliateAction(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
        return;
      }

      setError("An unexpected authentication error occurred.");
      setIsLoading(false);
    } catch {
      setError("An unexpected authentication error occurred.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 font-sans text-[var(--text-primary)]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="w-full max-w-[400px] rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-surface)] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Affiliate sign in
          </h1>
          <p className="text-xs font-medium text-[var(--text-primary)]/60 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            Track your earnings
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-[#E55345]/10 border border-[#E55345]/30 p-4 text-center text-sm font-semibold text-[#E55345] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

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

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              disabled={isLoading}
              required
              className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 pl-11 pr-11 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-4 top-3.5 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-primary)]/60">
          Not an affiliate yet?{" "}
          <Link href="/affiliate/register" className="text-[#E55345] hover:text-[#E55345]/80 font-semibold underline underline-offset-4 transition-colors">
            Register now
          </Link>
        </p>

        <p className="mt-8 text-center text-[10px] font-semibold text-[var(--text-primary)]/30 uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-mono, monospace)" }}>
          © 2026 Garrison Market
        </p>
      </div>
    </div>
  );
}