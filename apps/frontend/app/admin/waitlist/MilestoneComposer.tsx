// FILE: apps/frontend/app/admin/waitlist/MilestoneComposer.tsx (NEW FILE)
//
// Deliberately separate from GateToggle — sending this is a real,
// irreversible action (an email to everyone on the list), so it always
// shows the recipient count and requires an explicit confirm, unlike
// the gate toggle which is safe to flip repeatedly.

"use client";

import { useState } from "react";
import { sendWaitlistMilestoneAction } from "@/lib/waitlist.actions";

export default function MilestoneComposer({ recipientCount }: { recipientCount: number }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  async function handleSend() {
    setSending(true);
    const res = await sendWaitlistMilestoneAction(subject, body);
    setSending(false);
    setConfirming(false);
    if (res.success) {
      setResult({ sent: res.sent, failed: res.failed });
      setSubject("");
      setBody("");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-lg text-xs font-bold bg-[var(--bg-app)]/60 border border-slate-200/10 text-[var(--text-primary)] hover:border-[#E55345] transition"
      >
        Send milestone update
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 p-5 space-y-3">
      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60">
        Send milestone update to all {recipientCount.toLocaleString()} signups
      </div>

      {result && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
          Sent to {result.sent.toLocaleString()} people{result.failed > 0 ? ` (${result.failed} failed)` : ""}.
        </div>
      )}

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject — e.g. We just crossed 1,000 signups!"
        className="w-full bg-[var(--bg-surface)] border border-slate-200/10 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-[#E55345]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message..."
        rows={5}
        className="w-full bg-[var(--bg-surface)] border border-slate-200/10 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-[#E55345] resize-none"
      />

      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-[var(--text-primary)]/60">
              This will email all {recipientCount.toLocaleString()} people right now. Send?
            </span>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E55345] text-white hover:bg-[#c94337] transition disabled:opacity-50"
            >
              {sending ? "Sending..." : "Confirm send"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={sending}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirming(true)}
              disabled={!subject.trim() || !body.trim()}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#F1EEE3] text-[#0D1527] hover:bg-[#E55345] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review & send
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-xs font-bold text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}