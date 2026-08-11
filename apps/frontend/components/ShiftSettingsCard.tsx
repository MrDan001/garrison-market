// FILE: apps/frontend/components/ShiftSettingsCard.tsx (NEW FILE — Fix A)
//
// Owner-only. Lets the owner set what time counts as "on time" for staff
// clock-ins on the active store. Deliberately minimal — one field, one
// save action — rather than a full settings page, since this is the only
// store-level setting Rush currently needs.

"use client";

import { useState, useTransition } from "react";
import { Settings2, Check } from "lucide-react";
import { setShiftStartTime } from "@/lib/rush-clock.actions";

export default function ShiftSettingsCard({ initialShiftStartTime }: { initialShiftStartTime: string }) {
  const [value, setValue] = useState(initialShiftStartTime);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(false);
    startTransition(async () => {
      const result = await setShiftStartTime(value);
      setSaved(result.success);
      setError(!result.success);
      if (result.success) {
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xs font-bold text-fuchsia-200 uppercase tracking-wider mb-1 flex items-center gap-2">
        <Settings2 size={14} /> Shift start time
      </h2>
      <p className="text-xs text-fuchsia-200/60 mb-4">
        Staff who clock in at or before this time earn on-time XP for the day.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
        />
        <button
          type="button"
          disabled={isPending || value === initialShiftStartTime}
          onClick={handleSave}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-fuchsia-300/15 text-fuchsia-200 hover:bg-fuchsia-300/25 transition-colors disabled:opacity-40"
        >
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : isPending ? (
            "Saving…"
          ) : (
            "Save"
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-300 mt-2">Couldn't save — please try again.</p>}
    </div>
  );
}