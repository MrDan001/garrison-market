// FILE: apps/frontend/app/owner/rush/attendance/page.tsx (NEW FILE)
//
// Same pattern as the prizes and settlements sub-pages: owner-only auth
// check, fetch server-side, hand off to a client component for the
// interactive part. StaffClockRosterCard already does Today (live status)
// / 7 Days (attendance summary) — this page is just its new home, reached
// via the "Staff Clock-Ins" button on the main Rush screen instead of
// always sitting inline on that page.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getStaffClockRoster } from "@/lib/rush-clock.actions";
import StaffClockRosterCard from "@/components/StaffClockRosterCard";

export default async function OwnerAttendancePage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const staffRoster = await getStaffClockRoster();

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
          <h1 className="text-lg font-bold text-white">Staff Clock-Ins</h1>
          <p className="text-xs text-fuchsia-200/60 mt-0.5">
            Who clocked in today, what time they arrived and left, and how attendance has looked over the past week.
          </p>
        </div>

        <StaffClockRosterCard initialRoster={staffRoster} />
      </div>
    </div>
  );
}