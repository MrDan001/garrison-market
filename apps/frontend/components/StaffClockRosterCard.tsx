// FILE: apps/frontend/components/StaffClockRosterCard.tsx (UPDATED — now
// lives on its own page (app/owner/rush/attendance/page.tsx) instead of
// inline on the main Rush screen, reached via a button there. Because of
// that, an empty roster now shows a real empty state instead of
// returning null — a dedicated page should never render blank. Client
// component with a period toggle: "Today" renders instantly from
// initialRoster (fetched server-side). "7 Days" fetches
// getStaffClockRosterRange(7) on demand. Adding a future "1 Month" tab is
// just one more entry in PERIODS calling getStaffClockRosterRange(30) —
// the server action already takes a plain day count.)

"use client";

import { useState } from "react";
import {
  getStaffClockRosterRange,
  type StaffClockRosterEntry,
  type StaffClockRangeSummary,
} from "@/lib/rush-clock.actions";

type Period = "today" | 7;

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: 7, label: "7 Days" },
];

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StaffClockRosterCard({ initialRoster }: { initialRoster: StaffClockRosterEntry[] }) {
  const [period, setPeriod] = useState<Period>("today");
  const [rangeDays, setRangeDays] = useState(7);
  const [rangeSummary, setRangeSummary] = useState<StaffClockRangeSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (initialRoster.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
        <p className="text-sm font-semibold text-white">No staff yet</p>
        <p className="text-xs text-fuchsia-200/60 mt-1">
          Once staff are approved on this store, their clock-ins will show up here.
        </p>
      </div>
    );
  }

  async function selectPeriod(key: Period) {
    if (key === period) return;
    setPeriod(key);
    if (key === "today") return;

    setRangeDays(key);
    setLoading(true);
    const data = await getStaffClockRosterRange(key);
    setRangeSummary(data);
    setLoading(false);
  }

  const onShiftCount = initialRoster.filter((e) => e.clockedIn && !e.clockedOut).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-white">Staff Clock-Ins</h2>
        {period === "today" && (
          <span className="text-[11px] text-fuchsia-200/60">{onShiftCount} on shift now</span>
        )}
      </div>
      <p className="text-xs text-fuchsia-200/70 mb-4">
        {period === "today"
          ? "Who's clocked in, on time, and still on shift today."
          : `Attendance over the last ${rangeDays} days.`}
      </p>

      <div className="flex items-center gap-2 mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              period === p.key
                ? "bg-fuchsia-500 text-white"
                : "bg-white/5 text-fuchsia-200/60 border border-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "today" ? (
        <div className="space-y-2">
          {initialRoster.map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
                {entry.clockedIn ? (
                  <p className="text-[11px] text-fuchsia-200/60 mt-0.5">
                    In at {formatTime(entry.clockInAt!)}
                    {entry.clockedOut && ` · Out at ${formatTime(entry.clockOutAt!)}`}
                  </p>
                ) : (
                  <p className="text-[11px] text-fuchsia-200/50 mt-0.5">Not clocked in yet</p>
                )}
              </div>

              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                  !entry.clockedIn
                    ? "text-fuchsia-200/50 bg-white/5"
                    : entry.clockedOut
                    ? "text-fuchsia-200/70 bg-white/10"
                    : entry.onTime
                    ? "text-emerald-300 bg-emerald-500/10"
                    : "text-amber-300 bg-amber-500/10"
                }`}
              >
                {!entry.clockedIn ? "Absent" : entry.clockedOut ? "Done" : entry.onTime ? "On time" : "Late"}
              </span>
            </div>
          ))}
        </div>
      ) : loading || !rangeSummary ? (
        <div className="py-8 text-center text-xs text-fuchsia-200/50">Loading…</div>
      ) : (
        <div className="space-y-2">
          {rangeSummary.map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
                <p className="text-[11px] text-fuchsia-200/60 mt-0.5">
                  {entry.daysWorked} of {rangeDays} days
                  {entry.totalHours > 0 && ` · ${entry.totalHours}h total`}
                </p>
              </div>

              {entry.daysWorked === 0 ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-fuchsia-200/50 bg-white/5">
                  No shifts
                </span>
              ) : (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-fuchsia-200/70 bg-white/10">
                  {entry.daysOnTime} on time{entry.daysLate > 0 ? ` · ${entry.daysLate} late` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}