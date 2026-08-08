"use client";
// FILE: apps/frontend/app/admin/broadcast/broadcast-client.tsx

import { useEffect, useState } from "react";
import { sendBroadcastNotification, getBroadcastHistory, type BroadcastTargetType } from "@/lib/broadcast.actions";
import { Send, Users, UserCog, Building2, Globe, Bell, Link as LinkIcon, Loader2 } from "lucide-react";

type Owner = { id: number; fullName: string | null; storeName: string | null; email: string };
type Store = { id: number; name: string; ownerLabel: string | null };

const TARGET_OPTIONS: { value: BroadcastTargetType; label: string; icon: typeof Users }[] = [
  { value: "everyone", label: "Everyone", icon: Globe },
  { value: "owners", label: "All Owners", icon: Users },
  { value: "staff", label: "All Staff", icon: UserCog },
  { value: "owner_tenant", label: "One Owner + Staff", icon: Building2 },
  { value: "owner_only", label: "One Owner Only", icon: Building2 },
  { value: "store", label: "One Store's Staff", icon: Building2 },
];

// Mirrors attachTargetLabels() on the server, just for the optimistic
// row we add locally right after sending — the real label (from the
// server, resolved against fresh data) replaces it on next page load.
function resolveOptimisticTargetLabel(
  targetType: BroadcastTargetType,
  targetId: number | "",
  owners: Owner[],
  stores: Store[]
) {
  if (targetType === "owner_tenant" && targetId) {
    const o = owners.find((o) => o.id === targetId);
    return `Owner — ${o ? o.storeName || o.fullName || o.email : `#${targetId}`}`;
  }
  if (targetType === "owner_only" && targetId) {
    const o = owners.find((o) => o.id === targetId);
    return `Owner Only — ${o ? o.storeName || o.fullName || o.email : `#${targetId}`}`;
  }
  if (targetType === "store" && targetId) {
    const s = stores.find((s) => s.id === targetId);
    return `Store — ${s ? `${s.name}${s.ownerLabel ? ` (${s.ownerLabel})` : ""}` : `#${targetId}`}`;
  }
  return TARGET_OPTIONS.find((o) => o.value === targetType)?.label || targetType;
}

export default function BroadcastClient({
  owners,
  stores,
  initialHistory,
  initialHasMore,
}: {
  owners: Owner[];
  stores: Store[];
  initialHistory: any[];
  initialHasMore: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [targetType, setTargetType] = useState<BroadcastTargetType>("everyone");
  const [targetId, setTargetId] = useState<number | "">("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Mirrors the 10s server-side cooldown in sendBroadcastNotification —
  // this just keeps the button visibly disabled with a countdown instead
  // of letting someone click again and eat a server error.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const needsTargetId = targetType === "owner_tenant" || targetType === "owner_only" || targetType === "store";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (needsTargetId && !targetId) {
      setError(targetType === "owner_tenant" || targetType === "owner_only" ? "Pick an owner." : "Pick a store.");
      return;
    }
    if (link.trim() && !link.trim().startsWith("/")) {
      setError("Link must be an internal app path, e.g. /owner/promotions");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendBroadcastNotification({
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || null,
        targetType,
        targetId: needsTargetId ? (targetId as number) : null,
      });

      setSuccessMsg(`Sent to ${result.recipientCount} device${result.recipientCount === 1 ? "" : "s"}.`);
      setCooldown(10);
      setTitle("");
      setBody("");
      setLink("");
      setTargetId("");
      setHistory((prev) => [
        {
          id: result.broadcastId,
          title,
          body,
          link: link.trim() || null,
          targetType,
          targetId: needsTargetId ? targetId : null,
          targetLabel: resolveOptimisticTargetLabel(targetType, targetId, owners, stores),
          recipientCount: result.recipientCount,
          createdAt: new Date().toISOString(),
          sentBy: { email: "", fullName: "You" },
        },
        ...prev,
      ]);
    } catch (err: any) {
      setError(err?.message || "Failed to send broadcast.");
    } finally {
      setIsSending(false);
    }
  }

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const next = await getBroadcastHistory(history.length);
      setHistory((prev) => [...prev, ...next.broadcasts]);
      setHasMore(next.hasMore);
    } catch {
      // Silent — the "Load more" button just stays clickable to retry.
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Bell size={18} /> Push Broadcast
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Send a native push notification to pull owners/staff back into the app. Tapping it opens the app straight
          to the link you set below.
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Audience */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">Audience</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TARGET_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = targetType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTargetType(opt.value);
                      setTargetId("");
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      active
                        ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                        : "border-slate-200 dark:border-slate-800 text-slate-500"
                    }`}
                  >
                    <Icon size={14} /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {targetType === "owner_tenant" && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select an owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName || o.email} {o.storeName ? `— ${o.storeName}` : ""}
                </option>
              ))}
            </select>
          )}

          {targetType === "owner_only" && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select an owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName || o.email} {o.storeName ? `— ${o.storeName}` : ""}
                </option>
              ))}
            </select>
          )}

          {targetType === "store" && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.ownerLabel ? `— ${s.ownerLabel}` : ""}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Notification title, e.g. New Feature Unlocked 🎉"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={65}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500"
          />

          <textarea
            placeholder="Short message that shows under the title…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={180}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />

          <div className="relative">
            <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="/owner/promotions (optional — where tapping it should open)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-400">{error}</p>}
          {successMsg && <p className="text-xs font-medium text-emerald-400">{successMsg}</p>}

          <button
            type="submit"
            disabled={isSending || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={15} />
            {isSending ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s…` : "Send Push Notification"}
          </button>
        </form>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Recent Broadcasts</h2>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">No broadcasts sent yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{h.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{h.body}</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-600/10 border border-blue-500/30 rounded-full px-2 py-1 whitespace-nowrap">
                    {h.recipientCount} device{h.recipientCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {h.targetLabel || TARGET_OPTIONS.find((o) => o.value === h.targetType)?.label || h.targetType}
                  {h.link ? ` → ${h.link}` : ""} · {new Date(h.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[var(--text-primary)] hover:border-blue-400/50 transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : null}
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}