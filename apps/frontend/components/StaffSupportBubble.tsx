"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Store, Headphones, ChevronLeft, Sparkles } from "lucide-react";
import {
  getStaffOwnerThread, sendStaffMessage, setStaffTypingInOwnerThread,
  getStaffAdminThread, sendStaffToAdminMessage, setStaffTypingInAdminThread,
} from "@/lib/support.actions";
import { getIntakeContext, type IntakeContext } from "@/lib/support-intake.actions";
import ChatPanel from "./ChatPanel";
import SupportIntakeWizard from "./SupportIntakeWizard";
import AskMePanel from "./AskMePanel";

type View = "closed" | "choose" | "owner" | "admin" | "ask";

const POLL_INTERVAL_MS = 3000;

export default function StaffSupportBubble({ currentUserId }: { currentUserId: number }) {
  const [view, setView] = useState<View>("closed");
  const [ownerMessages, setOwnerMessages] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [adminIntake, setAdminIntake] = useState<IntakeContext | null>(null);
  const [needsIntake, setNeedsIntake] = useState(false);
  const prevCountRef = useRef(0);

  const pollBadge = async () => {
    if (view !== "closed") return;
    const [owner, admin] = await Promise.all([getStaffOwnerThread(), getStaffAdminThread()]);
    const combined = owner.messages.length + admin.messages.length;
    if (combined > prevCountRef.current && prevCountRef.current > 0) {
      setTotalUnread((u) => u + (combined - prevCountRef.current));
    }
    prevCountRef.current = combined;
  };

  useEffect(() => {
    pollBadge();
    const interval = setInterval(pollBadge, 10000);
    return () => clearInterval(interval);
  }, [view]);

  // Poll for new messages + the other party's typing status while a thread is open.
  useEffect(() => {
    if (view !== "owner" && view !== "admin") return;
    if (view === "admin" && needsIntake) return;

    const poll = async () => {
      if (view === "owner") {
        const data = await getStaffOwnerThread();
        setOwnerMessages(JSON.parse(JSON.stringify(data.messages)));
        setOtherTyping(data.otherTyping);
      } else {
        const data = await getStaffAdminThread();
        setAdminMessages(JSON.parse(JSON.stringify(data.messages)));
        setOtherTyping(data.otherTyping);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [view, needsIntake]);

  const openChooser = () => {
    setView("choose");
    setTotalUnread(0);
  };

  const openOwner = async () => {
    setView("owner");
    const data = await getStaffOwnerThread();
    setOwnerMessages(JSON.parse(JSON.stringify(data.messages)));
    setOtherTyping(data.otherTyping);
  };

  const openAdmin = async () => {
    setView("admin");
    const intake = await getIntakeContext("staff_admin");
    setAdminIntake(intake);
    if (intake?.needsIntake) {
      setNeedsIntake(true);
      return;
    }
    setNeedsIntake(false);
    const data = await getStaffAdminThread();
    setAdminMessages(JSON.parse(JSON.stringify(data.messages)));
    setOtherTyping(data.otherTyping);
  };

  const handleIntakeEscalated = async () => {
    setNeedsIntake(false);
    const data = await getStaffAdminThread();
    setAdminMessages(JSON.parse(JSON.stringify(data.messages)));
    setOtherTyping(data.otherTyping);
  };

  return (
    <>
      <button
        onClick={openChooser}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 flex items-center justify-center text-white transition-all active:scale-95"
        aria-label="Contact support"
      >
        <MessageCircle size={22} />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {view !== "closed" && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setView("closed")} />

          <div className="relative w-full sm:max-w-md sm:mx-4 h-[75vh] sm:h-[600px] bg-[var(--bg-app)] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl z-10 flex flex-col shadow-2xl overflow-hidden">

            {/* ── CHOOSER SCREEN ── */}
            {view === "choose" && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">Get in Touch</h2>
                    <p className="text-[11px] text-slate-500">Who would you like to message?</p>
                  </div>
                  <button onClick={() => setView("closed")} className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4 px-6">
                  <button
                    onClick={() => setView("ask")}
                    className="w-full flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-violet-600/15 to-violet-500/5 border border-violet-500/20 hover:border-violet-500/40 transition-all active:scale-[0.98] text-left"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/20">
                      <Sparkles size={24} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)]">Ask Me</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                        How to use the app — instant answers, any time
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={openOwner}
                    className="w-full flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-emerald-600/15 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-[0.98] text-left"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
                      <Store size={24} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)]">Your Store Owner</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                        Questions about a shift, a sale, or day-to-day store matters
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={openAdmin}
                    className="w-full flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-blue-600/15 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all active:scale-[0.98] text-left"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
                      <Headphones size={24} className="text-[var(--text-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)]">Garrison Market Support</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                        App issues, account problems, or anything urgent
                      </p>
                    </div>
                  </button>
                </div>

                <p className="px-6 pb-5 text-center text-[10px] text-slate-400 dark:text-slate-600">
                  We typically respond within a few hours
                </p>
              </>
            )}

            {/* ── OWNER CHAT ── */}
            {view === "owner" && (
              <>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
                  <button onClick={() => setView("choose")} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="h-9 w-9 rounded-xl bg-emerald-600/15 flex items-center justify-center">
                    <Store size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">Store Owner</h2>
                    <p className="text-[11px] text-slate-500">Usually replies within the day</p>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    messages={ownerMessages}
                    currentUserId={currentUserId}
                    otherTyping={otherTyping}
                    otherPartyName="Store Owner"
                    onTyping={setStaffTypingInOwnerThread}
                    onSend={async (content) => {
                      await sendStaffMessage(content);
                      const data = await getStaffOwnerThread();
                      setOwnerMessages(JSON.parse(JSON.stringify(data.messages)));
                      setOtherTyping(data.otherTyping);
                    }}
                    emptyStateTitle="Message your store owner"
                    emptyStateSub="Questions about a sale, a shift, or anything else — send it here."
                  />
                </div>
              </>
            )}

            {/* ── ADMIN CHAT ── */}
            {view === "admin" && (
              <>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
                  <button onClick={() => setView("choose")} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="h-9 w-9 rounded-xl bg-blue-600/15 flex items-center justify-center">
                    <Headphones size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">Garrison Market Support</h2>
                    <p className="text-[11px] text-slate-500">For urgent or app-related issues</p>
                  </div>
                </div>
                {needsIntake ? (
                  <SupportIntakeWizard
                    threadType="staff_admin"
                    role="staff"
                    prefill={adminIntake?.prefill ?? { name: "", email: "", storeName: "" }}
                    trialDaysLeft={adminIntake?.trialDaysLeft ?? null}
                    subscriptionStatus={adminIntake?.subscriptionStatus ?? "trialing"}
                    onEscalated={handleIntakeEscalated}
                  />
                ) : (
                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    messages={adminMessages}
                    currentUserId={currentUserId}
                    otherTyping={otherTyping}
                    otherPartyName="Support"
                    onTyping={setStaffTypingInAdminThread}
                    onSend={async (content) => {
                      await sendStaffToAdminMessage(content);
                      const data = await getStaffAdminThread();
                      setAdminMessages(JSON.parse(JSON.stringify(data.messages)));
                      setOtherTyping(data.otherTyping);
                    }}
                    emptyStateTitle="Contact support"
                    emptyStateSub="Reserved for issues your store owner can't resolve — we're here to help."
                  />
                </div>
                )}
              </>
            )}
            {/* ── ASK ME (AI) ── */}
            {view === "ask" && (
              <>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
                  <button onClick={() => setView("choose")} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="h-9 w-9 rounded-xl bg-violet-600/15 flex items-center justify-center">
                    <Sparkles size={16} className="text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">Ask Me</h2>
                    <p className="text-[11px] text-slate-500">Answers instantly, any time</p>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <AskMePanel role="staff" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}