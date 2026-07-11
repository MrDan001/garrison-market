"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { loginAction } from "@/lib/auth.actions";

export default function LoginPage() {
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
      const result = await loginAction(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
        // isLoading stays true — we're navigating away, no need to reset it
        return;
      }

      // Unexpected shape: no error and no redirectUrl
      setError("An unexpected authentication error occurred.");
      setIsLoading(false);
    } catch (err) {
      // Genuine network/script failures land here
      setError("An unexpected authentication error occurred.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1527] px-4 font-sans text-[#F1EEE3]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F1EEE3]/60 hover:text-[#F1EEE3] transition"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="w-full max-w-[400px] rounded-sm border border-[#F1EEE3]/10 bg-[#16233D] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[#F1EEE3]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Garrison Market
          </h1>
          <p className="text-xs font-medium text-[#F1EEE3]/60 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            Sign in to your shop floor
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-[#E55345]/10 border border-[#E55345]/30 p-4 text-center text-sm font-semibold text-[#E55345] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 h-4 w-4 text-[#F1EEE3]/40" />
            <input
              name="email"
              type="email"
              placeholder="Email address"
              disabled={isLoading}
              required
              className="w-full rounded-sm border border-[#F1EEE3]/10 bg-[#0D1527]/50 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#F1EEE3]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[#F1EEE3] placeholder:text-[#F1EEE3]/30 disabled:opacity-50"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[#F1EEE3]/40" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              disabled={isLoading}
              required
              className="w-full rounded-sm border border-[#F1EEE3]/10 bg-[#0D1527]/50 py-3.5 pl-11 pr-11 text-sm outline-none focus:border-[#F1EEE3]/40 focus:ring-1 focus:ring-[#F1EEE3]/40 transition-all text-[#F1EEE3] placeholder:text-[#F1EEE3]/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-4 top-3.5 text-[#F1EEE3]/40 hover:text-[#F1EEE3] transition-colors disabled:opacity-40"
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
                Authenticating...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#F1EEE3]/60">
          Don't have an account?{" "}
          <Link href="/register" className="text-[#E55345] hover:text-[#E55345]/80 font-semibold underline underline-offset-4 transition-colors">
            Register now
          </Link>
        </p>

        <p className="mt-8 text-center text-[10px] font-semibold text-[#F1EEE3]/30 uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-mono, monospace)" }}>
          © 2026 Garrison Market
        </p>
      </div>
    </div>
  );
}
