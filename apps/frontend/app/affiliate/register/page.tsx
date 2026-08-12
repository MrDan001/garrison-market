// FILE: apps/frontend/app/affiliate/register/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft, User, Phone, Landmark } from "lucide-react";
import { registerAffiliateAction } from "@/lib/affiliate.actions";

export default function AffiliateRegisterPage() {
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
      const result = await registerAffiliateAction(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
        return;
      }

      setError("An unexpected error occurred.");
      setIsLoading(false);
    } catch {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 py-12 font-sans text-[var(--text-primary)]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="w-full max-w-[440px] rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-surface)] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Become an affiliate
          </h1>
          <p className="text-xs font-medium text-[var(--text-primary)]/60 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            Earn 50% for 3 months, then 30%
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-[#E55345]/10 border border-[#E55345]/30 p-4 text-center text-sm font-semibold text-[#E55345] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
            <input
              name="fullName"
              type="text"
              placeholder="Full name"
              disabled={isLoading}
              required
              className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
            />
          </div>

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
            <Phone className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-primary)]/40" />
            <input
              name="phoneNumber"
              type="tel"
              placeholder="Phone number"
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
              minLength={8}
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

          {/* Bank details — optional at signup, needed before the first
              payout request. Collecting it now saves a step later, but
              nothing blocks registration if it's left blank. */}
          <div className="pt-2 pb-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono, monospace)" }}>
              <Landmark size={12} /> Payout bank details (optional for now)
            </p>
          </div>

          <input
            name="bankName"
            type="text"
            placeholder="Bank name"
            disabled={isLoading}
            className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 px-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="bankAccountNumber"
              type="text"
              placeholder="Account number"
              disabled={isLoading}
              className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 px-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
            />
            <input
              name="bankAccountName"
              type="text"
              placeholder="Account name"
              disabled={isLoading}
              className="w-full rounded-sm border border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/50 py-3.5 px-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/30 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center rounded-sm bg-[#F1EEE3] py-3.5 font-semibold text-[#0D1527] hover:bg-[#E2DDD0] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin h-4 w-4" />
                Creating account...
              </span>
            ) : (
              "Become an Affiliate"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-primary)]/60">
          Already an affiliate?{" "}
          <Link href="/affiliate/login" className="text-[#E55345] hover:text-[#E55345]/80 font-semibold underline underline-offset-4 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}