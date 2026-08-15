// FILE: apps/frontend/app/waitlist/thank-you/CopyLinkButton.tsx (NEW FILE)

"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyLinkButton({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);

  const link = typeof window !== "undefined"
    ? `${window.location.origin}/waitlist?ref=${referralCode}`
    : `https://gmstock.co/waitlist?ref=${referralCode}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) —
      // the link is still visible in the input for manual copy.
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 rounded-lg px-4 py-3 text-sm text-[var(--text-primary)]/80 font-mono"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider bg-[#F1EEE3] text-[#0D1527] px-5 py-3 rounded-lg hover:bg-[#E55345] hover:text-[var(--text-primary)] transition-colors shrink-0"
      >
        {copied ? (
          <>
            <Check size={16} strokeWidth={2.5} /> Copied
          </>
        ) : (
          <>
            <Copy size={16} strokeWidth={2.5} /> Copy
          </>
        )}
      </button>
    </div>
  );
}