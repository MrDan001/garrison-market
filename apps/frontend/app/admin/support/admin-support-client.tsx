// app/admin/support/admin-support-client.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import {
  getAdminOwnerThread, sendAdminReply, setAdminTypingInOwnerThread,
  getAdminStaffThread, sendAdminReplyToStaff, setAdminTypingInStaffThread,
} from "@/lib/support.actions";

const POLL_INTERVAL_MS = 3000;

export default function AdminSupportClient({
  currentUserId,
  ownerThreads,
  staffThreads,
}: {
  currentUserId: number;
  ownerThreads: any[];
  staffThreads: any[];
}) {
  const [active, setActive] = useState<{ type: "owner" | "staff"; id: number } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);

  const openOwnerThread = async (ownerId: number) => {
    setActive({ type: "owner", id: ownerId });
    const data = await getAdminOwnerThread(ownerId);
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  const openStaffThread = async (staffId: number) => {
    setActive({ type: "staff", id: staffId });
    const data = await getAdminStaffThread(staffId);
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  // Poll for new messages + the other party's typing status while a thread is open.
  useEffect(() => {
    if (!active) return;

    const poll = async () => {
      const data =
        active.type === "owner"
          ? await getAdminOwnerThread(active.id)
          : await getAdminStaffThread(active.id);
      setMessages(data.messages);
      setOtherTyping(data.otherTyping);
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  if (active) {
    const isOwner = active.type === "owner";
    const info = isOwner
      ? ownerThreads.find((t) => t.owner.id === active.id)?.owner
      : staffThreads.find((t) => t.staff.id === active.id)?.staff;

    const handleTyping = () => {
      if (isOwner) {
        setAdminTypingInOwnerThread(active.id);
      } else {
        setAdminTypingInStaffThread(active.id);
      }
    };

    return (
      <div className="h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={() => setActive(null)} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)]">
              {isOwner ? info?.storeName || info?.fullName : info?.fullName}
            </h1>
            <p className="text-[11px] text-slate-500">
              {isOwner ? `Owner — ${info?.fullName}` : `Staff — ${info?.owner?.storeName ?? ""}`}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            otherTyping={otherTyping}
            otherPartyName={isOwner ? info?.storeName || info?.fullName : info?.fullName}
            otherPartyImage={info?.image}
            onTyping={handleTyping}
            onSend={async (content) => {
              if (isOwner) {
                await sendAdminReply(active.id, content);
                const data = await getAdminOwnerThread(active.id);
                setMessages(data.messages);
                setOtherTyping(data.otherTyping);
              } else {
                await sendAdminReplyToStaff(active.id, content);
                const data = await getAdminStaffThread(active.id);
                setMessages(data.messages);
                setOtherTyping(data.otherTyping);
              }
            }}
            emptyStateTitle="No messages yet"
            emptyStateSub="Nothing here yet."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/admin/dashboard" className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] hover:bg-slate-200 hover:dark:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-[var(--text-primary)]">Support Inbox</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Store Owners</p>
          {ownerThreads.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 px-1">No owner conversations yet.</p>
          ) : (
            ownerThreads.map(({ owner, lastMessage, unreadCount }) => (
              <button
                key={owner.id}
                onClick={() => openOwnerThread(owner.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:dark:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0 overflow-hidden">
                  {owner.image ? <img src={owner.image} alt="" className="h-full w-full object-cover" /> : owner.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{owner.storeName || owner.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{lastMessage?.content}</p>
                </div>
                {unreadCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Staff (Direct)</p>
          {staffThreads.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 px-1">No direct staff messages yet.</p>
          ) : (
            staffThreads.map(({ staff, lastMessage, unreadCount }) => (
              <button
                key={staff.id}
                onClick={() => openStaffThread(staff.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:dark:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-purple-400 shrink-0 overflow-hidden">
                  {staff.image ? <img src={staff.image} alt="" className="h-full w-full object-cover" /> : staff.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{staff.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{lastMessage?.content}</p>
                </div>
                {unreadCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}