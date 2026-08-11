// FILE: apps/frontend/components/RushGuide.tsx (NEW FILE — Stage 2)
//
// Renders the content from lib/rush-guide-content.ts as an accordion —
// long enough content that showing it all open at once would be a wall
// of text on a phone screen. XP sources are filtered to what's actually
// relevant to the viewer's role; the navigation section is left
// unfiltered on purpose, since "For staff: ..." / "For owners: ..." lines
// there are already self-labeled and it's useful for either role to know
// what the other one sees.

"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Zap, TrendingUp, Flame, ListChecks, Gift, HeartPulse, Trophy, Compass } from "lucide-react";
import {
  RUSH_XP_SOURCES,
  RUSH_LEVELS,
  RUSH_STREAKS,
  RUSH_QUESTS,
  RUSH_SPIN,
  RUSH_SHOP_HEALTH,
  RUSH_LEADERBOARD,
  RUSH_NAVIGATION,
} from "@/lib/rush-guide-content";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {items.map((item, i) => (
        <li key={i} className="text-xs text-fuchsia-200/70 leading-relaxed flex gap-2">
          <span className="text-fuchsia-300 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RushGuide({ role }: { role: "staff" | "owner" }) {
  const [openId, setOpenId] = useState<string | null>("xp");

  const xpSources = RUSH_XP_SOURCES.filter((s) => s.role === "both" || s.role === role);

  const sections: { id: string; icon: ReactNode; title: string; content: ReactNode }[] = [
    {
      id: "xp",
      icon: <Zap size={16} />,
      title: "How to earn XP",
      content: (
        <div className="space-y-3 mt-2">
          {xpSources.map((source) => (
            <div key={source.type} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">{source.label}</p>
                <p className="text-xs text-fuchsia-200/70 mt-0.5 leading-relaxed">{source.how}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-emerald-300">+{source.amount} XP</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "levels",
      icon: <TrendingUp size={16} />,
      title: "Levels",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_LEVELS.summary}</p>
          <BulletList items={RUSH_LEVELS.details} />
        </>
      ),
    },
    {
      id: "streaks",
      icon: <Flame size={16} />,
      title: "Streaks",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_STREAKS.summary}</p>
          <BulletList items={RUSH_STREAKS.details} />
        </>
      ),
    },
    {
      id: "quests",
      icon: <ListChecks size={16} />,
      title: "Daily quests",
      content: (
        <div className="space-y-4">
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_QUESTS.summary}</p>
          <div>
            <p className="text-sm font-semibold text-white mb-1">{RUSH_QUESTS.restockRun.label}</p>
            <BulletList items={RUSH_QUESTS.restockRun.details} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">{RUSH_QUESTS.salesSprint.label}</p>
            <BulletList items={RUSH_QUESTS.salesSprint.details} />
          </div>
        </div>
      ),
    },
    {
      id: "spin",
      icon: <Gift size={16} />,
      title: "Reward spin",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_SPIN.summary}</p>
          <BulletList items={RUSH_SPIN.details} />
        </>
      ),
    },
    {
      id: "health",
      icon: <HeartPulse size={16} />,
      title: "Shop health",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_SHOP_HEALTH.summary}</p>
          <BulletList items={RUSH_SHOP_HEALTH.details} />
        </>
      ),
    },
    {
      id: "leaderboard",
      icon: <Trophy size={16} />,
      title: "Leaderboard",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_LEADERBOARD.summary}</p>
          <BulletList items={RUSH_LEADERBOARD.details} />
        </>
      ),
    },
    {
      id: "navigation",
      icon: <Compass size={16} />,
      title: "Finding your way around",
      content: (
        <>
          <p className="text-xs text-fuchsia-200/70 leading-relaxed">{RUSH_NAVIGATION.summary}</p>
          <BulletList items={RUSH_NAVIGATION.details} />
        </>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        return (
          <div key={section.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : section.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="flex items-center gap-2.5 text-sm font-bold text-white">
                <span className="text-fuchsia-300">{section.icon}</span> {section.title}
              </span>
              <ChevronDown
                size={16}
                className={`text-fuchsia-300/70 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && <div className="px-5 pb-5">{section.content}</div>}
          </div>
        );
      })}
    </div>
  );
}