// FILE: apps/frontend/app/affiliate/settings/SettingsForm.tsx

"use client";

import { useState } from "react";
import { updateAffiliateSettingsAction } from "@/lib/affiliate.actions";

export default function SettingsForm({
  affiliateId,
  affiliate,
}: {
  affiliateId: number;
  affiliate: {
    email: string;
    fullName: string;
    phoneNumber: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
  };
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateAffiliateSettingsAction(affiliateId, formData);

    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputCls =
    "w-full rounded-sm border border-[var(--border-subtle)]/15 bg-[var(--bg-app)]/50 py-3 px-4 text-sm outline-none focus:border-[var(--border-subtle)]/40 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
      <div>
        <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold block mb-1.5">Email (fixed)</label>
        <input value={affiliate.email} disabled className={`${inputCls} opacity-50`} />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold block mb-1.5">Phone number</label>
        <input name="phoneNumber" defaultValue={affiliate.phoneNumber} className={inputCls} />
      </div>

      <div className="pt-2">
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-3">Payout bank details</p>
        <div className="space-y-3">
          <input name="bankName" defaultValue={affiliate.bankName || ""} placeholder="Bank name" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="bankAccountNumber"
              defaultValue={affiliate.bankAccountNumber || ""}
              placeholder="Account number"
              className={inputCls}
            />
            <input
              name="bankAccountName"
              defaultValue={affiliate.bankAccountName || ""}
              placeholder="Account name"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-[#E55345]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-[var(--text-primary)] text-[var(--bg-app)] px-5 py-2.5 rounded-xl text-xs font-semibold hover:opacity-85 transition disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}