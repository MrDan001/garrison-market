// FILE: apps/frontend/components/ClockInOutCard.tsx (NEW FILE — Fix A)
//
// Staff-only. Self-fetching client component, same pattern as
// RestockRunCard — fetches its own status on mount rather than requiring
// RushWorldView to thread the prop through.

"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { getTodayClockStatus, clockIn, clockOut, type ClockStatus } from "@/lib/rush-clock.actions";

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// shiftStartTime comes through as a raw "HH:mm" 24-hour string (that's
// what's stored and what the owner's <input type="time"> edits) — this
// is purely a display-layer conversion to something friendlier, e.g.
// "08:00" -> "8:00 AM".
function formatShiftTime(hhmm: string): string {
  const [hoursStr, minutesStr] = hhmm.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return hhmm;
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  return today.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ClockInOutCard() {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getTodayClockStatus();
      if (!cancelled) {
        setStatus(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="h-9 w-full bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (!status) return null;

  const handleClockIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await clockIn();
      if (result.success) {
        const fresh = await getTodayClockStatus();
        setStatus(fresh);
      } else {
        setError("Couldn't clock in — please try again.");
      }
    });
  };

  const handleClockOut = () => {
    setError(null);
    startTransition(async () => {
      const result = await clockOut();
      if (result.success) {
        const fresh = await getTodayClockStatus();
        setStatus(fresh);
      } else {
        setError("Couldn't clock out — please try again.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock size={16} className="text-fuchsia-300" /> Clock In / Clock Out
        </h2>
        <span className="text-[11px] text-fuchsia-200/60">Shift starts {formatShiftTime(status.shiftStartTime)}</span>
      </div>
      <p className="text-xs text-fuchsia-200/70 mb-4">
        Clock in at or before {formatShiftTime(status.shiftStartTime)} to earn on-time XP.
      </p>

      {!status.clockedIn ? (
        <button
          type="button"
          disabled={isPending}
          onClick={handleClockIn}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-fuchsia-300/15 text-fuchsia-200 hover:bg-fuchsia-300/25 transition-colors disabled:opacity-60"
        >
          <LogIn size={15} /> {isPending ? "Clocking in…" : "Clock In"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Clocked in at {formatTime(status.clockInAt!)}</p>
              {status.onTime ? (
                <p className="text-[11px] text-emerald-300 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} /> On time — XP awarded
                </p>
              ) : (
                <p className="text-[11px] text-fuchsia-200/60 mt-0.5">After shift start — no on-time XP today</p>
              )}
            </div>
          </div>

          {status.clockedOut ? (
            <p className="text-xs text-fuchsia-200/60 text-center">
              Clocked out at {formatTime(status.clockOutAt!)}. See you tomorrow.
            </p>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={handleClockOut}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-60"
            >
              <LogOut size={15} /> {isPending ? "Clocking out…" : "Clock Out"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-300 mt-3 text-center">{error}</p>}
    </div>
  );
}