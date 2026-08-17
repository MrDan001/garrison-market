// FILE: apps/frontend/app/waitlist/thank-you/FeedbackForm.tsx (NEW FILE)
//
// Step 2 of the split signup flow. The person already committed at
// step 1 (they're on the list), so these 3 pain-point questions are
// framed as "help us build the right thing" rather than a gate — all
// fields are optional and there's an explicit skip, since forcing
// answers here would just recreate the original bounce problem one
// step later.

"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { submitWaitlistFeedbackAction } from "@/lib/waitlist.actions";

export default function FeedbackForm({ referralCode }: { referralCode: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/35 focus:outline-none focus:border-[#E55345] transition-colors resize-none";
  const labelClass = "block text-sm font-semibold text-[var(--text-primary)] mb-2";

  async function submit(formData: FormData) {
    setError(null);
    setLoading(true);
    formData.set("referralCode", referralCode);
    const result = await submitWaitlistFeedbackAction(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] p-6 sm:p-8">
        <p className="text-sm text-[var(--text-primary)]/80">
          Thanks — this genuinely helps us build the right thing. 🙏
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] p-6 sm:p-8 space-y-4">
      <div>
        <p className="text-lg font-extrabold tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Help us build the perfect app for you
        </p>
        <p className="text-sm text-[var(--text-primary)]/60">
          Totally optional — but it's how we know what your shop want, and how we can help you manage your store properly.
        </p>
      </div>

      <div>
        <label htmlFor="toolFrustrations" className={labelClass}>
          What frustrates you about the tools you use now?
        </label>
        <textarea id="toolFrustrations" name="toolFrustrations" rows={3} placeholder="Tell us here..." className={inputClass} />
      </div>

      <div>
        <label htmlFor="biggestChallenge" className={labelClass}>
          What's your biggest challenge running your shop?
        </label>
        <textarea id="biggestChallenge" name="biggestChallenge" rows={3} placeholder="Tell us here..." className={inputClass} />
      </div>

      <div>
        <label htmlFor="wantToSee" className={labelClass}>
          What do you want to see on Garrison Market?
        </label>
        <textarea id="wantToSee" name="wantToSee" rows={3} placeholder="Tell us here..." className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider bg-[#F1EEE3] text-[#0D1527] px-5 py-3 rounded-lg hover:bg-[#E55345] hover:text-[var(--text-primary)] transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              Send feedback <Send size={14} strokeWidth={2.5} />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setDone(true)}
          className="text-sm font-semibold text-[var(--text-primary)]/40 hover:text-[var(--text-primary)]/70 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}