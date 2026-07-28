"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, Phone, ArrowLeft } from "lucide-react";
import { registerStaffAction } from "@/lib/auth.actions";
import UpgradeLimitModal, { isLimitReachedError } from "@/components/UpgradeLimitModal";

export default function StaffRegistrationForm({ storeId }: { storeId?: number | null }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [limitModalMessage, setLimitModalMessage] = useState<string | null>(null);
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
      if (isLimitReachedError(result?.error)) {
        setLimitModalMessage(result!.error!);
      } else {
        alert(result?.error || "Something went wrong. Please try again.");
      }
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in duration-500">
        <div className="rounded-full bg-emerald-500/10 p-4 mb-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-[var(--text-primary)] text-lg font-medium">Staff Registered!</h2>
        <p className="text-slate-500 text-sm">Redirecting to management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {limitModalMessage && (
        <UpgradeLimitModal message={limitModalMessage} onClose={() => setLimitModalMessage(null)} />
      )}

      <form action={handleSubmit} className="space-y-6">
        {storeId != null && (
          <input type="hidden" name="storeId" value={storeId} />
        )}

        <div className="relative">
          <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-600" />
          <input name="fullName" placeholder="Staff Full Name" required className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-sm" />
        </div>

        <div className="relative">
          <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-600" />
          <input name="email" type="email" placeholder="Staff Email" required className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-sm" />
        </div>

        <div className="relative">
          <Phone className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-600" />
          <input name="phoneNumber" type="tel" placeholder="Staff Phone Number" required className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-3 pl-12 pr-4 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-sm" />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-600" />
          <input name="tempPassword" type={showPassword ? "text" : "password"} placeholder="Temporary Password" required className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-3 pl-12 pr-12 outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-sm" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 dark:text-slate-600">
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-[0.4] py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all disabled:opacity-50 flex items-center justify-center shadow-md shadow-blue-500/20"
          >
            {isLoading ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : "Register Staff Member"}
          </button>
        </div>
      </form>
    </div>
  );
}