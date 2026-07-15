// app/owner/support/owner-support-client.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, ChevronRight } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import {
  getOwnerStaffThread,
  sendOwnerToStaffMessage,
  getOwnerAdminThread,
  sendOwnerToAdminMessage,
} from "@/lib/support.actions";

export default function OwnerSupportClient({
  currentUserId,
  staffThreads,
  adminMessages,
}: {
  currentUserId: number;
  staffThreads: any[];
  adminMessages: any[];
}) {
  const [activeView, setActiveView] = useState<"list" | "admin" | number>("list");
  const [messages, setMessages] = useState<any[]>(adminMessages);

  const openAdmin = async () => {
    setActiveView("admin");
    const data = await getOwnerAdminThread();
    setMessages(data);
  };

  const openStaff = async (staffId: number) => {
    setActiveView(staffId);
    const data = await getOwnerStaffThread(staffId);
    setMessages(data);
  };

  if (activeView !== "list") {
    const isAdmin = activeView === "admin";
    const staffInfo = !isAdmin ? staffThreads.find((t) => t.staff.id === activeView)?.staff : null;

    return (
      <div className="h-screen bg-[#0A0C12] text-slate-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 shrink-0">
          <button onClick={() => setActiveView("list")} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">{isAdmin ? "Garrison Market Support" : staffInfo?.fullName}</h1>
            <p className="text-[11px] text-slate-500">{isAdmin ? "App support & assistance" : "Staff conversation"}</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            onSend={async (content) => {
              if (isAdmin) {
                await sendOwnerToAdminMessage(content);
                setMessages(await getOwnerAdminThread());
              } else {
                await sendOwnerToStaffMessage(activeView as number, content);
                setMessages(await getOwnerStaffThread(activeView as number));
              }
            }}
            emptyStateTitle={isAdmin ? "Contact support" : "Message this staff member"}
            emptyStateSub={isAdmin ? "Questions about the app, billing, or an issue? We're here." : "Reply to their questions or send updates."}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C12] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#11131A] border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/owner/dashboard" className="h-8 w-8 rounded-lg bg-[#161a29] hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-white">Messages</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <button
          onClick={openAdmin}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Headphones size={19} className="text-white" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-white">Garrison Market Support</p>
            <p className="text-xs text-slate-400 truncate">Get help with the app directly</p>
          </div>
          <ChevronRight size={18} className="text-slate-600 shrink-0" />
        </button>

        {staffThreads.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Staff Messages</p>
            {staffThreads.map(({ staff, lastMessage, unreadCount }) => (
              <button
                key={staff.id}
                onClick={() => openStaff(staff.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#11131A] border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0 overflow-hidden">
                  {staff.image ? (
                    <img src={staff.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    staff.fullName?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white">{staff.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {lastMessage ? lastMessage.content : "No messages yet"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadCount}
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