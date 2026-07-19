"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Store, Save, AlertCircle, MapPin, Phone, Package, Building2, ChevronDown } from "lucide-react";
import { createStoreAction } from "@/lib/business.actions";
import { NIGERIAN_LOCATIONS } from "@/lib/nigeria-locations";

const STATES = Object.keys(NIGERIAN_LOCATIONS).sort();

export default function CreateStorePage() {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const availableCities = selectedState ? NIGERIAN_LOCATIONS[selectedState] : [];

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedCity(""); // reset city whenever state changes
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createStoreAction(formData);
      } catch (err: any) {
        if (err.digest?.includes("NEXT_REDIRECT")) return;
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/stores" className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Store size={16} className="text-[var(--text-primary)]" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Register New Location</h1>
        </div>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto mt-4">
          <p className="text-xs text-slate-500 leading-relaxed px-1">
            Expand your business network by registering a new physical storefront or distribution branch.
          </p>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-blue-400" />
              <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Store Details</h2>
            </div>

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
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Phone size={11} /> Outlet Contact Number
              </label>
              <input
                name="phoneNumber"
                type="tel"
                disabled={isPending}
                placeholder="e.g. +234..."
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-emerald-400" />
              <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Location</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Street Address
              </label>
              <input
                name="address"
                type="text"
                disabled={isPending}
                placeholder="e.g. 12 Aba Road"
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-emerald-600 disabled:opacity-50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  State
                </label>
                <div className="relative">
                  <select
                    name="state"
                    value={selectedState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={isPending}
                    className="w-full appearance-none bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-9 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-600 disabled:opacity-50 transition-colors"
                  >
                    <option value="">Select state...</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  City / LGA
                </label>
                <div className="relative">
                  <select
                    name="city"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    disabled={isPending || !selectedState}
                    className="w-full appearance-none bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-9 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-600 disabled:opacity-40 transition-colors"
                  >
                    <option value="">{selectedState ? "Select LGA..." : "Select state first"}</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* What they sell */}
          <div className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-amber-400" />
              <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">What This Store Sells</h2>
            </div>
            <textarea
              name="productsSold"
              disabled={isPending}
              placeholder="e.g. Groceries, electronics, phone accessories..."
              className="w-full h-20 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-amber-600 disabled:opacity-50 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white py-4 rounded-xl font-bold text-sm mt-2 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 disabled:opacity-50 active:scale-[0.98]"
          >
            <Save size={16} />
            {isPending ? "Creating Outlet..." : "Save Store Outlet"}
          </button>
        </form>
      </div>
    </div>
  );
}