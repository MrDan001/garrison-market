// FILE: apps/frontend/app/owner/rush/prizes/page.tsx (UPDATED — Stage W2 moves the shift start time setting here from the main Rush screen, since "resumption time" and "prizes" both live under one owner-config surface now.)

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getShiftStartTime } from "@/lib/rush-clock.actions";
import PrizePoolManager from "@/components/PrizePoolManager";
import ShiftSettingsCard from "@/components/ShiftSettingsCard";

export default async function OwnerPrizePoolPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const shiftStartTime = await getShiftStartTime();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0b26] via-[#1e1b4b] to-[#0f0b26] text-white px-4 py-6 sm:px-8 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/owner/rush"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-200/70 hover:text-fuchsia-200 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Rush
        </Link>

        <div>
          <h1 className="text-lg font-bold text-white">Spin Prizes &amp; Shift Settings</h1>
          <p className="text-xs text-fuchsia-200/60 mt-0.5">
            Set what counts as "on time" for staff, and manage what they can win from the daily spin — edit or turn
            off the defaults, or add your own cash and gift prizes.
          </p>
        </div>

        <ShiftSettingsCard initialShiftStartTime={shiftStartTime} />

        <PrizePoolManager />
      </div>
    </div>
  );
}