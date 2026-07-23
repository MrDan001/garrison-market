"use client";

import Link from "next/link";
import { X, Mail, Crown, LifeBuoy } from "lucide-react";
import { LIMIT_REACHED_PREFIX } from "@/lib/limit-message";

/**
 * True if a server action error string is the "plan limit reached" message
 * (as opposed to validation errors, auth errors, etc). Call sites use this
 * to decide whether to show <UpgradeLimitModal /> instead of a plain inline
 * error banner.
 */
export function isLimitReachedError(message: string | null | undefined): boolean {
  return !!message && message.startsWith(LIMIT_REACHED_PREFIX);
}

/** Strips the internal marker prefix, leaving the raw message body. */
export function stripLimitReachedPrefix(message: string): string {
  return message.startsWith(LIMIT_REACHED_PREFIX)
    ? message.slice(LIMIT_REACHED_PREFIX.length)
    : message;
}

/**
 * Renders the "*bold*" spans from the message template as <strong>, and
 * preserves line breaks. Keeps the message content itself defined in one
 * place (lib/subscription-guard.ts) while still letting it render styled.
 */
function renderFormattedMessage(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*[^*]+\*)/g).filter(Boolean);
    return (
      <p key={i} className={line.trim() === "" ? "h-3" : "leading-relaxed"}>
        {parts.map((part, j) =>
          part.startsWith("*") && part.endsWith("*") && part.length > 1 ? (
            <strong key={j} className="font-semibold text-[var(--text-primary)]">
              {part.slice(1, -1)}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </p>
    );
  });
}

export default function UpgradeLimitModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const body = stripLimitReachedPrefix(message);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-limit-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Mail size={16} className="text-amber-500" />
            </div>
            <h2 id="upgrade-limit-modal-title" className="text-sm font-bold text-[var(--text-primary)]">
              Subscription Limit Reached
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-1 text-xs text-slate-600 dark:text-slate-400">
          {renderFormattedMessage(body)}
        </div>

        <div className="flex flex-col gap-2 p-5 pt-4">
          <Link
            href="/owner/billing"
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Crown size={16} />
            Go to Premium Billing
          </Link>
          <Link
            href="/owner/support"
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[var(--text-primary)] text-sm font-bold hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
          >
            <LifeBuoy size={16} />
            Contact Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
