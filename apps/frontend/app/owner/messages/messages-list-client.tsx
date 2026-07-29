"use client";
// FILE: apps/frontend/app/owner/messages/messages-list-client.tsx

import Link from "next/link";
import { ArrowLeft, Mail, MailOpen, ImageIcon, Link as LinkIcon } from "lucide-react";

type MessageRow = {
  id: number;
  subject: string;
  preview: string;
  imageUrl: string | null;
  link: string | null;
  createdAt: Date;
  isRead: boolean;
};

function timeAgo(date: Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function MessagesListClient({ messages }: { messages: MessageRow[] }) {
  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/owner/profile" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3 mb-6 lg:mb-8">
          <Mail className="text-indigo-500" /> Messages
          {unreadCount > 0 && (
            <span className="text-xs font-bold bg-indigo-500 text-white rounded-full px-2.5 py-1">{unreadCount} new</span>
          )}
        </h1>

        {messages.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
            <Mail className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
            No messages yet.
            <p className="text-xs mt-2 text-slate-500/80 max-w-xs mx-auto">
              Announcements and messages from the Garrison Market team will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <Link
                key={m.id}
                href={`/owner/messages/${m.id}`}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
                  m.isRead
                    ? "border-slate-200/70 dark:border-slate-800/70 bg-[var(--bg-surface)]"
                    : "border-indigo-500/30 bg-indigo-500/5"
                }`}
              >
                <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${m.isRead ? "bg-slate-100 dark:bg-slate-900 text-slate-400" : "bg-indigo-500/15 text-indigo-500"}`}>
                  {m.isRead ? <MailOpen size={16} /> : <Mail size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${m.isRead ? "font-medium text-[var(--text-primary)]" : "font-bold text-[var(--text-primary)]"}`}>
                      {m.subject}
                    </p>
                    <span className="text-[11px] text-slate-500 shrink-0">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{m.preview}</p>
                  {(m.imageUrl || m.link) && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {m.imageUrl && <span className="flex items-center gap-1 text-[11px] text-slate-400"><ImageIcon size={11} /> Image</span>}
                      {m.link && <span className="flex items-center gap-1 text-[11px] text-slate-400"><LinkIcon size={11} /> Link</span>}
                    </div>
                  )}
                </div>
                {!m.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}