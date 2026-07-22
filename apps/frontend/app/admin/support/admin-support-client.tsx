// app/admin/support/admin-support-client.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import {
  getAdminOwnerThread, sendAdminReply, setAdminTypingInOwnerThread,
  getAdminStaffThread, sendAdminReplyToStaff, setAdminTypingInStaffThread,
} from "@/lib/support.actions";
import { adminCloseIntake, markIntakeRead } from "@/lib/support-intake.actions";
import {
  labelForCategory, labelForUrgency, labelForDetail,
} from "@/lib/support-intake-config";
import type { IntakeInboxRow } from "@/lib/support-intake.actions";

const POLL_INTERVAL_MS = 3000;

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const URGENCY_STYLE: Record<string, string> = {
  urgent: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  important: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  question: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function AdminSupportClient({
  currentUserId,
  inbox,
}: {
  currentUserId: number;
  inbox: IntakeInboxRow[];
}) {
  const [rows, setRows] = useState<IntakeInboxRow[]>(inbox);
  const [active, setActive] = useState<IntakeInboxRow | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [justResolved, setJustResolved] = useState(false);

  const isStaffRow = (row: IntakeInboxRow) => row.threadType === "staff_admin";

  const fetchThread = async (row: IntakeInboxRow) => {
    const data = isStaffRow(row)
      ? await getAdminStaffThread(row.staffId as number)
      : await getAdminOwnerThread(row.ownerId);
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  const openRow = async (row: IntakeInboxRow) => {
    setActive(row);
    setMessages([]);
    setOtherTyping(false);

    if (!row.adminRead) {
      markIntakeRead(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, adminRead: true } : r)));
    }

    // Self-resolved submissions never escalated into a chat thread —
    // nothing to fetch, just show the answers.
    if (!row.resolvedBySelf) {
      await fetchThread(row);
    }
  };

  const handleMarkResolved = async () => {
    if (!active) return;
    if (isStaffRow(active)) {
      await adminCloseIntake("staff_admin", 0, active.staffId as number);
    } else {
      await adminCloseIntake("owner_admin", active.ownerId);
    }
    setRows((prev) => prev.map((r) => (r.id === active.id ? { ...r, status: "closed" } : r)));
    setActive((prev: IntakeInboxRow | null) => (prev ? { ...prev, status: "closed" } : prev));
    setJustResolved(true);
    setTimeout(() => setJustResolved(false), 2500);
  };

  // Poll for new messages while an escalated thread is open.
  useEffect(() => {
    if (!active || active.resolvedBySelf) return;
    const interval = setInterval(() => fetchThread(active), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  const handleTyping = () => {
    if (!active) return;
    if (isStaffRow(active)) {
      setAdminTypingInStaffThread(active.staffId as number);
    } else {
      setAdminTypingInOwnerThread(active.ownerId);
    }
  };

  // ── Detail / reply view ──
  if (active) {
    return (
      <div className="h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={() => setActive(null)} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[var(--text-primary)] truncate">
              {active.storeName || active.name}
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {isStaffRow(active) ? "Staff" : "Owner"} — {active.name} · {active.email}
            </p>
          </div>
          {active.status === "open" && !active.resolvedBySelf && (
            <button
              onClick={handleMarkResolved}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/30 transition-colors shrink-0"
            >
              <CheckCircle2 size={13} />
              {justResolved ? "Resolved ✓" : "Mark resolved"}
            </button>
          )}
        </div>

        {/* Submitted form answers — always visible to admin regardless of chat state */}
        <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 space-y-2 shrink-0 max-h-[40vh] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
              {labelForCategory(active.category)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${URGENCY_STYLE[active.urgency] ?? URGENCY_STYLE.question}`}>
              {labelForUrgency(active.urgency)}
            </span>
            {active.resolvedBySelf && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Self-resolved
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">{timeAgo(active.createdAt)}</span>
          </div>
          {active.blockingSales && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Blocking sales/POS:</span>{" "}
              {active.blockingSales === "yes" ? "Yes" : "No"}
            </p>
          )}
          {active.detailAnswer && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Details:</span>{" "}
              {labelForDetail(active.category, active.detailAnswer)}
            </p>
          )}
          {active.triedSelfHelp && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Tried self-help:</span>{" "}
              {active.triedSelfHelp}
            </p>
          )}
          {active.extraNotes && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Notes:</span> {active.extraNotes}
            </p>
          )}
        </div>

        {active.resolvedBySelf ? (
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-600 max-w-[240px]">
              This person resolved it themselves from the self-serve suggestion — no reply thread was opened.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              messages={messages}
              currentUserId={currentUserId}
              otherTyping={otherTyping}
              otherPartyName={active.storeName || active.name}
              onTyping={handleTyping}
              onSend={async (content) => {
                if (isStaffRow(active)) {
                  await sendAdminReplyToStaff(active.staffId as number, content);
                } else {
                  await sendAdminReply(active.ownerId, content);
                }
                await fetchThread(active);
              }}
              emptyStateTitle="No reply yet"
              emptyStateSub="Send a reply to get this conversation going."
            />
          </div>
        )}
      </div>
    );
  }

  // ── Inbox table ──
  const unreadTotal = rows.filter((r) => !r.adminRead).length;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/admin/dashboard" className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] hover:bg-slate-200 hover:dark:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-[var(--text-primary)]">Support Inbox</h1>
        {unreadTotal > 0 && (
          <span className="h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {unreadTotal}
          </span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-600 px-1 py-10 text-center">
            No support submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold"></th>
                  <th className="px-4 py-3 font-bold">Requester</th>
                  <th className="px-4 py-3 font-bold">Role</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Urgency</th>
                  <th className="px-4 py-3 font-bold">Submitted</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openRow(row)}
                    className="border-b border-slate-100 dark:border-slate-900 last:border-0 hover:bg-slate-100/50 hover:dark:bg-slate-900/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      {!row.adminRead && <Circle size={7} className="fill-blue-500 text-blue-500" />}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-semibold ${row.adminRead ? "text-slate-700 dark:text-slate-300" : "text-[var(--text-primary)]"}`}>
                        {row.storeName || row.name}
                      </p>
                      <p className="text-slate-400 dark:text-slate-600">{row.name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.threadType === "staff_admin" ? "Staff" : "Owner"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{labelForCategory(row.category)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${URGENCY_STYLE[row.urgency] ?? URGENCY_STYLE.question}`}>
                        {labelForUrgency(row.urgency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-600">{timeAgo(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      {row.resolvedBySelf ? (
                        <span className="text-emerald-500">Self-resolved</span>
                      ) : row.status === "open" ? (
                        <span className="text-amber-500">Open</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}