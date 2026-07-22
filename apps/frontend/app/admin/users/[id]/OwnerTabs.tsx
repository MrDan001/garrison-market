"use client";

import { useState } from "react";
import { Users, History, Settings } from "lucide-react";

interface OwnerTabsProps {
  referralsTabContent: React.ReactNode;
  historyTabContent: React.ReactNode;
  actionsTabContent: React.ReactNode;
}

export function OwnerTabs({ referralsTabContent, historyTabContent, actionsTabContent }: OwnerTabsProps) {
  const [activeTab, setActiveTab] = useState<"referrals" | "history" | "actions">("referrals");

  return (
    <div>
      {/* Tab Header Buttons */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("referrals")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "referrals"
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Users size={14} /> Referrals & Rewards
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "history"
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          }`}
        >
          <History size={14} /> Subscription History
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "actions"
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          }`}
        >
          <Settings size={14} /> Management Actions
        </button>
      </div>

      {/* Tab Body Display */}
      <div>
        {activeTab === "referrals" && referralsTabContent}
        {activeTab === "history" && historyTabContent}
        {activeTab === "actions" && actionsTabContent}
      </div>
    </div>
  );
}