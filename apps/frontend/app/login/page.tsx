"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { loginAction } from "@/lib/auth.actions";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    
    // Call the server action
    const result = await loginAction(formData);
    
    // If the action returned an error (e.g., "Account under review"),
    // show it to the user. If it succeeds, the redirect inside 
    // loginAction will take over automatically.
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1EEE3] px-4 font-sans text-[#16233D]">
      {/* 
        Page Card Wrapper with smooth hardware-accelerated entry animation
      */}
      <div className="w-full max-w-[400px] rounded-sm border border-[#16233D]/10 bg-white shadow-[0_20px_50px_-12px_rgba(22,35,61,0.15)] p-10 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
        
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#16233D] text-[#C89A2E]">
            <span className="text-xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>G</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-[#16233D]" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            Garrison Market
          </h1>
          <p className="text-xs font-medium text-[#16233D]/60 uppercase tracking-wider mt-1">
            Sign in to your shop floor
          </p>
        </div>

        {/* Error Notification Block — Terracotta Red theme */}
        {error && (
          <div className="mb-6 rounded-sm bg-[#B23A2E]/5 border border-[#B23A2E]/20 p-4 text-center text-sm font-medium text-[#B23A2E] shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 h-4 w-4 text-[#16233D]/40" />
            <input 
              name="email" 
              type="email" 
              placeholder="Email address" 
              disabled={isLoading}
              required 
              className="w-full rounded-sm border border-[#16233D]/20 bg-[#F1EEE3]/30 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#16233D] focus:ring-1 focus:ring-[#16233D] transition-all text-[#16233D] placeholder:text-[#16233D]/40 disabled:opacity-60" 
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[#16233D]/40" />
            <input 
              name="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              disabled={isLoading}
              required 
              className="w-full rounded-sm border border-[#16233D]/20 bg-[#F1EEE3]/30 py-3 pl-11 pr-11 text-sm outline-none focus:border-[#16233D] focus:ring-1 focus:ring-[#16233D] transition-all text-[#16233D] placeholder:text-[#16233D]/40 disabled:opacity-60" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              disabled={isLoading}
              className="absolute right-4 top-3.5 text-[#16233D]/40 hover:text-[#16233D] transition-colors disabled:opacity-40"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Interactive Loading Button — Deep Navy Theme */}
          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex items-center justify-center rounded-sm bg-[#16233D] py-3.5 font-semibold text-[#F1EEE3] hover:bg-[#1B2E4D] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
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

        {/* Redirect Option — Terracotta Red highlight */}
        <p className="mt-6 text-center text-sm text-[#16233D]/60">
          Don't have an account?{" "}
          <Link href="/register" className="text-[#B23A2E] hover:text-[#B23A2E]/80 font-semibold underline underline-offset-4 transition-colors">
            Register now
          </Link>
        </p>

        {/* Utilitarian Footer */}
        <p className="mt-8 text-center text-[10px] font-semibold text-[#16233D]/40 uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-mono, monospace)" }}>
          © 2026 Garrison Market
        </p>
      </div>
    </div>
  );
}