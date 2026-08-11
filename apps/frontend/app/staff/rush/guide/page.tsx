// FILE: apps/frontend/app/staff/rush/guide/page.tsx (NEW FILE — Stage 2)

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import RushGuide from "@/components/RushGuide";

export default async function StaffRushGuidePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0b26] via-[#1e1b4b] to-[#0f0b26] text-white px-4 py-6 sm:px-8 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/staff/rush"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-200/70 hover:text-fuchsia-200 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Rush
        </Link>

        <div>
          <h1 className="text-lg font-bold text-white">How to Play</h1>
          <p className="text-xs text-fuchsia-200/60 mt-0.5">Everything about Rush — XP, levels, streaks, quests, spins, and more.</p>
        </div>

        <RushGuide role="staff" />
      </div>
    </div>
  );
}