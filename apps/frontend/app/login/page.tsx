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
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 font-sans text-slate-200">
      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[600px] w-[600px] rounded-full bg-blue-900/10 blur-[150px]" />
        <div className="absolute top-[30%] -right-[10%] h-[600px] w-[600px] rounded-full bg-indigo-900/10 blur-[150px]" />
      </div>

      <div className="w-full max-w-[400px] rounded-[2rem] border border-slate-800 bg-slate-900/50 backdrop-blur-3xl shadow-2xl p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
            <span className="text-2xl font-bold tracking-tighter">GM</span>
          </div>
          <h1 className="text-xl font-medium text-slate-100">Garrison Market</h1>
          <p className="text-sm text-slate-500">Sign in to the administrative panel</p>
        </div>

        {/* Error Notification Block */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-950/30 border border-red-900/50 p-4 text-center text-sm text-red-400 shadow-sm animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input 
              name="email" 
              type="email" 
              placeholder="Email address" 
              required 
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-700/50 transition-all text-slate-200 placeholder:text-slate-700" 
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input 
              name="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              required 
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-12 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-700/50 transition-all text-slate-200 placeholder:text-slate-700" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-4 top-3.5 text-slate-600 hover:text-slate-400 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full flex items-center justify-center rounded-2xl bg-slate-100 py-3.5 font-semibold text-slate-950 hover:bg-slate-300 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Register now
          </Link>
        </p>

        <p className="mt-8 text-center text-[10px] font-medium text-slate-700 uppercase tracking-[0.2em]">
          © 2026 Garrison Market
        </p>
      </div>
    </div>
  );
}