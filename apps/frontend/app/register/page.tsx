"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Phone, 
  Store, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  ChevronRight 
} from "lucide-react";
import { registerOwnerAction } from "@/lib/auth.actions";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    try {
      await registerOwnerAction(formData);
    } catch (err) {
      setError("Registration failed. Please check your details.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 py-12 font-sans text-slate-200">
      {/* Background Glows */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[600px] w-[600px] rounded-full bg-blue-900/10 blur-[150px]" />
        <div className="absolute bottom-[0%] -right-[10%] h-[600px] w-[600px] rounded-full bg-indigo-900/10 blur-[150px]" />
      </div>

      <div className="w-full max-w-[450px] rounded-[2.5rem] border border-slate-800 bg-slate-900/40 backdrop-blur-3xl shadow-2xl p-8 md:p-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400 shadow-inner">
            <Store size={28} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Partner with Us</h1>
          <p className="text-sm text-slate-500 mt-2">Create your owner account to start selling</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-950/30 border border-red-900/50 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="relative">
            <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input
              name="fullName"
              type="text"
              placeholder="Full Name"
              required
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-200 placeholder:text-slate-700"
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input
              name="email"
              type="email"
              placeholder="Email address"
              required
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-200 placeholder:text-slate-700"
            />
          </div>

          {/* Store Name */}
          <div className="relative">
            <Store className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input
              name="storeName"
              type="text"
              placeholder="Store Name"
              required
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-200 placeholder:text-slate-700"
            />
          </div>

          {/* Phone Number */}
          <div className="relative">
            <Phone className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input
              name="phoneNumber"
              type="tel"
              placeholder="Phone Number"
              required
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-200 placeholder:text-slate-700"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create Password"
              required
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-12 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-200 placeholder:text-slate-700"
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
            className="group w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 font-semibold text-slate-950 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                Create Owner Account
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already a partner?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}