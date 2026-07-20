// app/owner/support/owner-support-client.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, ChevronRight } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import SupportIntakeWizard from "@/components/SupportIntakeWizard";
import {
  getOwnerStaffThread,
  sendOwnerToStaffMessage,
  setOwnerTypingInStaffThread,
  getOwnerAdminThread,
  sendOwnerToAdminMessage,
  setOwnerTypingInAdminThread,
} from "@/lib/support.actions";
import type { IntakeContext } from "@/lib/support-intake.actions";

const POLL_INTERVAL_MS = 3000;

export default function OwnerSupportClient({
  currentUserId,
  staffThreads,
  adminMessages,
  adminIntake,
}: {
  currentUserId: number;
  staffThreads: any[];
  adminMessages: any[];
  adminIntake: IntakeContext | null;
}) {
  const [activeView, setActiveView] = useState<"list" | "admin" | number>("list");
  const [messages, setMessages] = useState<any[]>(adminMessages);
  const [otherTyping, setOtherTyping] = useState(false);
  const [needsIntake, setNeedsIntake] = useState(adminIntake?.needsIntake ?? false);

  const openAdmin = async () => {
    setActiveView("admin");
    if (needsIntake) return;
    const data = await getOwnerAdminThread();
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  const handleIntakeEscalated = async () => {
    setNeedsIntake(false);
    const data = await getOwnerAdminThread();
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  const openStaff = async (staffId: number) => {
    setActiveView(staffId);
    const data = await getOwnerStaffThread(staffId);
    setMessages(data.messages);
    setOtherTyping(data.otherTyping);
  };

  // Poll for new messages + the other party's typing status while a thread is open.
  useEffect(() => {
    if (activeView === "list") return;
    if (activeView === "admin" && needsIntake) return;

    const poll = async () => {
      const data =
        activeView === "admin"
          ? await getOwnerAdminThread()
          : await getOwnerStaffThread(activeView as number);
      setMessages(data.messages);
      setOtherTyping(data.otherTyping);
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeView, needsIntake]);

  if (activeView !== "list") {
    const isAdmin = activeView === "admin";
    const staffInfo = !isAdmin ? staffThreads.find((t) => t.staff.id === activeView)?.staff : null;

    const handleTyping = () => {
      if (isAdmin) {
        setOwnerTypingInAdminThread();
      } else {
        setOwnerTypingInStaffThread(activeView as number);
      }
    };

    return (
      <div className="h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={() => setActiveView("list")} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)]">{isAdmin ? "Garrison Market Support" : staffInfo?.fullName}</h1>
            <p className="text-[11px] text-slate-500">{isAdmin ? "App support & assistance" : "Staff conversation"}</p>
          </div>
        </div>
        {isAdmin && needsIntake ? (
          <SupportIntakeWizard
            threadType="owner_admin"
            role="owner"
            prefill={adminIntake?.prefill ?? { name: "", email: "", storeName: "" }}
            trialDaysLeft={adminIntake?.trialDaysLeft ?? null}
            subscriptionStatus={adminIntake?.subscriptionStatus ?? "trialing"}
            onEscalated={handleIntakeEscalated}
          />
        ) : (
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            otherTyping={otherTyping}
            otherPartyName={isAdmin ? "Support" : staffInfo?.fullName}
            otherPartyImage={isAdmin ? null : staffInfo?.image}
            onTyping={handleTyping}
            onSend={async (content) => {
              if (isAdmin) {
                await sendOwnerToAdminMessage(content);
                const data = await getOwnerAdminThread();
                setMessages(data.messages);
                setOtherTyping(data.otherTyping);
              } else {
                await sendOwnerToStaffMessage(activeView as number, content);
                const data = await getOwnerStaffThread(activeView as number);
                setMessages(data.messages);
                setOtherTyping(data.otherTyping);
              }
            }}
            emptyStateTitle={isAdmin ? "Contact support" : "Message this staff member"}
            emptyStateSub={isAdmin ? "Questions about the app, billing, or an issue? We're here." : "Reply to their questions or send updates."}
          />
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/owner/dashboard" className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] hover:bg-slate-200 hover:dark:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-[var(--text-primary)]">Messages</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <button
          onClick={openAdmin}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Headphones size={19} className="text-[var(--text-primary)]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Garrison Market Support</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Get help with the app directly</p>
          </div>
          <ChevronRight size={18} className="text-slate-400 dark:text-slate-600 shrink-0" />
        </button>

        {staffThreads.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Staff Messages</p>
            {staffThreads.map(({ staff, lastMessage, unreadCount }) => (
              <button
                key={staff.id}
                onClick={() => openStaff(staff.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:dark:border-slate-700 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0 overflow-hidden">
                  {staff.image ? (
                    <img src={staff.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    staff.fullName?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{staff.fullName}</p>
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