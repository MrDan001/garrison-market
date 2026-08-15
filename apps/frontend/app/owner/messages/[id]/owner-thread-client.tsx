"use client";
// FILE: apps/frontend/app/owner/messages/[id]/owner-thread-client.tsx

import { useEffect, useState } from "react";
import { sendOwnerReplyAction } from "@/lib/admin-message.actions";
import { getOwnerThreadStatusAction } from "@/lib/admin-thread-close.actions";
import { Send, ShieldCheck, Star, User } from "lucide-react";

type Reply = { id: number; authorRole: string; body: string; createdAt: Date };

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

export default function OwnerThreadClient({
  messageId,
  channel,
  initialReplies,
}: {
  messageId: number;
  channel: string;
  initialReplies: Reply[];
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closed state is fetched client-side (same pattern as the admin thread
  // view) rather than passed down from the server component, since it can
  // change at any time after this page has already loaded — an admin
  // closing the thread in another tab shouldn't require the owner to
  // manually refresh to lose the ability to reply.
  const [threadStatus, setThreadStatus] = useState<"open" | "closed">("open");
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOwnerThreadStatusAction(messageId).then((result) => {
      if (!cancelled) {
        setThreadStatus(result.status);
        setReviewUrl(result.reviewUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  async function handleSendReply() {
    if (!replyBody.trim() || threadStatus === "closed") return;
    setSending(true);
    setError(null);
    try {
      const result = await sendOwnerReplyAction(messageId, replyBody.trim());
      if (!result.success) {
        setError(result.error || "Failed to send reply.");
        return;
      }
      setReplies((prev) => [
        ...prev,
        { id: Date.now(), authorRole: "owner", body: replyBody.trim(), createdAt: new Date() },
      ]);
      setReplyBody("");
    } catch (err: any) {
      setError(err?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      {replies.length > 0 && (
        <div className="p-5 sm:p-6 space-y-3 border-b border-slate-200/60 dark:border-slate-800/60">
          {replies.map((r) => (
            <div key={r.id} className={`flex ${r.authorRole === "owner" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  r.authorRole === "owner"
                    ? "rounded-tr-sm bg-blue-600 text-white"
                    : "rounded-tl-sm bg-slate-100 dark:bg-slate-900 text-[var(--text-primary)]"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-bold mb-1 ${
                    r.authorRole === "owner" ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {r.authorRole === "owner" ? <User size={11} /> : <ShieldCheck size={11} />}
                  {r.authorRole === "owner" ? "You" : "Garrison Market"}
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                <p className={`text-[10px] mt-1 ${r.authorRole === "owner" ? "text-blue-100/80" : "text-slate-400"}`}>
                  {timeAgo(r.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-5 sm:p-6">
        {error && <p className="text-xs font-semibold text-rose-500 mb-2">{error}</p>}
        {threadStatus === "closed" ? (
          <div className="text-center py-2 space-y-3">
            <p className="text-xs font-semibold text-slate-500">
              This conversation has been closed. Replies are no longer accepted here.
            </p>
            {reviewUrl && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                <Star size={14} /> Rate us on Google
              </a>
            )}
          </div>
        ) : channel !== "email" ? (
          <p className="text-xs text-slate-400 text-center py-2">
            This is a pop-up message — it's info-only and isn't repliable.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
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
              You can also just reply to the email if that's easier.
            </p>
          </>
        )}
      </div>
    </div>
  );
}