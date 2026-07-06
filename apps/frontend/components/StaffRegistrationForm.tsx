"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, Phone, ArrowLeft } from "lucide-react"; // 1. Import ArrowLeft
import { registerStaffAction } from "@/lib/auth.actions"; 

export default function StaffRegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    const result = await registerStaffAction(formData);

    if (result?.success) {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/owner/staff"); 
      }, 2000);
    } else {
      setIsLoading(false);
      alert(result?.error || "Something went wrong. Please try again.");
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in duration-500">
        <div className="rounded-full bg-emerald-500/10 p-4 mb-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-white text-lg font-medium">Staff Registered!</h2>
        <p className="text-slate-500 text-sm">Redirecting to management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2. Added Back Button */}
      <button 
        type="button" 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <form action={handleSubmit} className="space-y-6">
        <div className="relative">
          <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
          <input name="fullName" placeholder="Staff Full Name" required className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-200" />
        </div>

        <div className="relative">
          <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
          <input name="email" type="email" placeholder="Staff Email" required className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-200" />
        </div>

        <div className="relative">
          <Phone className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
          <input name="phoneNumber" type="tel" placeholder="Staff Phone Number" required className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-200" />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-600" />
          <input name="tempPassword" type={showPassword ? "text" : "password"} placeholder="Temporary Password" required className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 py-3 pl-12 pr-12 outline-none focus:border-blue-500 text-slate-200" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-600">
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <button type="submit" disabled={isLoading} className="w-full py-4 bg-white text-slate-950 font-bold rounded-2xl hover:bg-slate-200 transition-all">
          {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Register Staff Member"}
        </button>
      </form>
    </div>
  );
}