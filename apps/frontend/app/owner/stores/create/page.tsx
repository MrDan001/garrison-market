"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation"; // Added router for extra control
import Link from "next/link";
import { ArrowLeft, Store, Save, AlertCircle } from "lucide-react";
import { createStoreAction } from "@/lib/business.actions";

export default function CreateStorePage() {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createStoreAction(formData);
      } catch (err: any) {
        // Next.js redirect() throws an error that is handled internally.
        // We only show the error if it's NOT a redirect error.
        if (err.digest?.includes("NEXT_REDIRECT")) return;
        
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/stores" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <Store size={20} className="text-blue-500" />
          <h1 className="text-xl font-bold text-white tracking-tight">Register New Location</h1>
        </div>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto mt-4">
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Expand your business network by registering a new physical storefront or distribution branch.
            </p>

            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Store Name *
              </label>
              <input 
                name="name" 
                type="text"
                required 
                disabled={isPending}
                placeholder="e.g. Garrison Market - Branch 2"
                className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Outlet Contact Number (Optional)
              </label>
              <input 
                name="phoneNumber" 
                type="tel"
                disabled={isPending}
                placeholder="e.g. +234..."
                className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white py-4 rounded-xl font-bold text-sm mt-6 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 disabled:opacity-50"
          >
            <Save size={16} /> 
            {isPending ? "Creating Outlet..." : "Save Store Outlet"}
          </button>
        </form>
      </div>
    </div>
  );
}