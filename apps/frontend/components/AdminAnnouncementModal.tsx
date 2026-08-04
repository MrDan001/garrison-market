"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink, CheckCircle2 } from "lucide-react";

export type AdminAnnouncementMessage = {
  id: number;
  subject: string;
  body: string;
  link?: string | null;
  imageUrl?: string | null;
  createdAt: string | Date;
};

/**
 * The pop-up an owner/staff sees when the admin broadcasts an announcement
 * (system update, upgrade notice, etc). Deliberately framed as coming from
 * a person/team — "Admin Desk" — rather than a generic system toast, per
 * product decision. Three-part layout:
 *   Header — "Message from the Admin Desk" badge + subject
 *   Body   — center-aligned message text, optional image, optional link
 *   Footer — "Acknowledged" button + sender signature/timestamp
 *
 * This component is purely presentational — it doesn't know how to fetch
 * the next pending message or persist the acknowledgment; the caller
 * (wired in a later stage) passes the message in and handles onAcknowledge.
 */
export default function AdminAnnouncementModal({
  message,
  onAcknowledge,
}: {
  message: AdminAnnouncementMessage;
  onAcknowledge: () => void | Promise<void>;
}) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  async function handleAcknowledge() {
    if (isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      await onAcknowledge();
    } finally {
      setIsAcknowledging(false);
    }
  }

  const sentAt = new Date(message.createdAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-announcement-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-900 text-center">
          <div className="h-11 w-11 rounded-full bg-blue-600/10 flex items-center justify-center">
            <ShieldCheck size={20} className="text-blue-500" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-500">
            Message from the Admin Desk
          </span>
          <h2 id="admin-announcement-title" className="text-base font-bold text-[var(--text-primary)] leading-snug">
            {message.subject}
          </h2>
        </div>

        {/* Body — center aligned */}
        <div className="px-6 py-5 flex flex-col items-center text-center gap-4">
          {message.imageUrl && (
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={message.imageUrl} alt="" className="w-full max-h-56 object-cover" />
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
            {message.body}
          </p>

          {message.link && (
            <a
              href={message.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
            >
              Learn more <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-1 flex flex-col items-center gap-3">
          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            <CheckCircle2 size={16} />
            {isAcknowledging ? "Acknowledging…" : "Acknowledged"}
          </button>
          <p className="text-[11px] text-slate-400">
            Garrison Market Admin Team · {sentAt}
          </p>
        </div>
      </div>
    </div>
  );
}