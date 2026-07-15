// app/admin/support/admin-support-client.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import {
  getAdminOwnerThread, sendAdminReply,
  getAdminStaffThread, sendAdminReplyToStaff,
} from "@/lib/support.actions";

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

  const openOwnerThread = async (ownerId: number) => {
    setActive({ type: "owner", id: ownerId });
    setMessages(await getAdminOwnerThread(ownerId));
  };

  const openStaffThread = async (staffId: number) => {
    setActive({ type: "staff", id: staffId });
    setMessages(await getAdminStaffThread(staffId));
  };

  if (active) {
    const isOwner = active.type === "owner";
    const info = isOwner
      ? ownerThreads.find((t) => t.owner.id === active.id)?.owner
      : staffThreads.find((t) => t.staff.id === active.id)?.staff;

    return (
      <div className="h-screen bg-[#0A0C12] text-slate-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 shrink-0">
          <button onClick={() => setActive(null)} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">
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
            onSend={async (content) => {
              if (isOwner) {
                await sendAdminReply(active.id, content);
                setMessages(await getAdminOwnerThread(active.id));
              } else {
                await sendAdminReplyToStaff(active.id, content);
                setMessages(await getAdminStaffThread(active.id));
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
    <div className="min-h-screen bg-[#0A0C12] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#11131A] border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/admin/dashboard" className="h-8 w-8 rounded-lg bg-[#161a29] hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-white">Support Inbox</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Store Owners</p>
          {ownerThreads.length === 0 ? (
            <p className="text-xs text-slate-600 px-1">No owner conversations yet.</p>
          ) : (
            ownerThreads.map(({ owner, lastMessage, unreadCount }) => (
              <button
                key={owner.id}
                onClick={() => openOwnerThread(owner.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#11131A] border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0 overflow-hidden">
                  {owner.image ? <img src={owner.image} alt="" className="h-full w-full object-cover" /> : owner.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white">{owner.storeName || owner.fullName}</p>
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
            <p className="text-xs text-slate-600 px-1">No direct staff messages yet.</p>
          ) : (
            staffThreads.map(({ staff, lastMessage, unreadCount }) => (
              <button
                key={staff.id}
                onClick={() => openStaffThread(staff.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#11131A] border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-purple-400 shrink-0 overflow-hidden">
                  {staff.image ? <img src={staff.image} alt="" className="h-full w-full object-cover" /> : staff.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white">{staff.fullName}</p>
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