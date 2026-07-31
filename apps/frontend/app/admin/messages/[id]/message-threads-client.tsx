"use client";
// FILE: apps/frontend/app/admin/messages/[id]/message-threads-client.tsx

import { useState } from "react";
import Link from "next/link";
import { getAdminMessageThread, sendAdminReplyAction } from "@/lib/admin-message.actions";
import { ArrowLeft, MessageCircle, Send, ShieldCheck, User } from "lucide-react";

type MessageSummary = { id: number; subject: string; body: string; audience: string; createdAt: Date };
type ThreadSummary = {
  ownerId: number;
  ownerName: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  needsReply: boolean;
};
type Reply = { id: number; ownerId: number; authorRole: string; body: string; createdAt: Date };

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

export default function MessageThreadsClient({
  message,
  initialThreads,
}: {
  message: MessageSummary;
  initialThreads: ThreadSummary[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [openOwnerId, setOpenOwnerId] = useState<number | null>(null);
  const [openOwnerName, setOpenOwnerName] = useState<string>("");
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openThread(ownerId: number, ownerName: string | null) {
    setOpenOwnerId(ownerId);
    setOpenOwnerName(ownerName || "Owner");
    setLoadingThread(true);
    setError(null);
    setReplyBody("");
    try {
      const data = await getAdminMessageThread(message.id, ownerId);
      setReplies((data?.replies as Reply[]) || []);
    } finally {
      setLoadingThread(false);
    }
  }

  function closeThread() {
    setOpenOwnerId(null);
    setReplies([]);
  }

  async function handleSendReply() {
    if (!openOwnerId || !replyBody.trim()) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendAdminReplyAction(message.id, openOwnerId, replyBody.trim());
      if (!result.success) {
        setError(result.error || "Failed to send reply.");
        return;
      }
      const newReply: Reply = {
        id: Date.now(),
        ownerId: openOwnerId,
        authorRole: "admin",
        body: replyBody.trim(),
        createdAt: new Date(),
      };
      setReplies((prev) => [...prev, newReply]);
      setReplyBody("");
      setThreads((prev) =>
        prev.map((t) =>
          t.ownerId === openOwnerId
            ? { ...t, replyCount: t.replyCount + 1, lastReplyAt: newReply.createdAt, needsReply: false }
            : t
        )
      );
    } catch (err: any) {
      setError(err?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }

  // Thread (conversation) view for the selected owner
  if (openOwnerId !== null) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={closeThread}
            className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 w-fit text-sm font-semibold"
          >
            <ArrowLeft size={18} /> Back to recipients
          </button>

          <div className="mb-4">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{message.subject}</p>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1">{openOwnerName}</h1>
          </div>

          <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: "50vh" }}>
            <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto">
              {/* Original broadcast, shown as the first bubble for context */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-900 px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
                    <ShieldCheck size={11} /> You (original message)
                  </div>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{message.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{timeAgo(message.createdAt)}</p>
                </div>
              </div>

              {loadingThread ? (
                <p className="text-xs text-slate-500 text-center py-4">Loading conversation…</p>
              ) : (
                replies.map((r) => (
                  <div key={r.id} className={`flex ${r.authorRole === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        r.authorRole === "admin"
                          ? "rounded-tr-sm bg-blue-600 text-white"
                          : "rounded-tl-sm bg-slate-100 dark:bg-slate-900 text-[var(--text-primary)]"
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-[11px] font-bold mb-1 ${
                          r.authorRole === "admin" ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {r.authorRole === "admin" ? <ShieldCheck size={11} /> : <User size={11} />}
                        {r.authorRole === "admin" ? "You" : openOwnerName}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                      <p className={`text-[10px] mt-1 ${r.authorRole === "admin" ? "text-blue-100/80" : "text-slate-400"}`}>
                        {timeAgo(r.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {!loadingThread && replies.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">
                  No replies yet — {openOwnerName} hasn't responded to this message.
                </p>
              )}
            </div>

            <div className="p-3 sm:p-4 border-t border-slate-200/60 dark:border-slate-800/60">
              {error && <p className="text-xs font-semibold text-rose-500 mb-2">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Reply to ${openOwnerName}…`}
                  rows={2}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyBody.trim()}
                  className="shrink-0 h-11 w-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Sends in-app and by email — {openOwnerName} can reply from either.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recipient list view
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/messages" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back to Messages
        </Link>

        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{message.subject}</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            {message.audience === "single_owner" ? "Sent to one owner" : "Sent to all owners"}
            {" · "}
            {new Date(message.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recipients</h2>

        {threads.length === 0 ? (
          <p className="text-xs text-slate-500">No recipients found.</p>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.ownerId}
                onClick={() => openThread(t.ownerId, t.ownerName)}
                className="w-full flex items-center justify-between gap-3 bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-4 py-3 text-left hover:border-blue-400/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.ownerName || "Owner"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.replyCount > 0
                      ? `${t.replyCount} repl${t.replyCount === 1 ? "y" : "ies"} · ${t.lastReplyAt ? timeAgo(t.lastReplyAt) : ""}`
                      : "No replies yet"}
                  </p>
                </div>
                {t.needsReply && (
                  <span className="flex items-center gap-1 text-xs font-bold bg-indigo-500 text-white rounded-full px-2 py-1 shrink-0">
                    <MessageCircle size={11} /> Needs reply
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}