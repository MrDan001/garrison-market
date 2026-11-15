"use client";

import { FormEvent, useState, useTransition } from "react";
import { CheckCircle2, Globe2, Loader2, Save } from "lucide-react";
import { BUSINESS_COUNTRIES, BUSINESS_CURRENCIES } from "@/lib/business-localization";
import { updateBusinessLocalizationAction } from "@/lib/business-localization.actions";

export default function BusinessLocalizationForm({
  initialCountry,
  initialCurrency,
}: {
  initialCountry: string;
  initialCurrency: string;
}) {
  const [country, setCountry] = useState(initialCountry || "NG");
  const [currency, setCurrency] = useState(initialCurrency || "NGN");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCountryChange(value: string) {
    setCountry(value);
    const match = BUSINESS_COUNTRIES.find((item) => item.code === value);
    if (match) setCurrency(match.currency);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateBusinessLocalizationAction(formData);
      setMessage(result.message || result.error || "Unable to save settings.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
        <Globe2 className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-[var(--text-primary)]/75 leading-relaxed">
          Your operating currency is used for inventory prices, sales, expenses, invoices and reports for both owners and staff. To protect your records, the operating currency is locked after inventory or financial activity has been created.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="businessCountry" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]/65">Business country</label>
        <select id="businessCountry" name="businessCountry" value={country} onChange={(event) => handleCountryChange(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {BUSINESS_COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="currencyCode" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]/65">Operating currency</label>
        <select id="currencyCode" name="currencyCode" value={currency} onChange={(event) => setCurrency(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {BUSINESS_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
        <p className="text-xs text-slate-500">The selected currency is shared by every store and staff account under this business.</p>
      </div>

      {message && <p role="status" className="text-sm text-emerald-600 flex items-center gap-2"><CheckCircle2 size={16} />{message}</p>}

      <button type="submit" disabled={isPending} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-50">
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save business settings
      </button>
    </form>
  );
}
