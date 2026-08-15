// FILE: apps/frontend/app/admin/waitlist/page.tsx (NEW FILE)

import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRegistrationOpen } from "@/lib/system-settings.actions";
import {
  getWaitlistAdminStats,
  getWaitlistLeaderboard,
  listWaitlistForAdmin,
  getPendingReleaseCount,
} from "@/lib/waitlist.actions";
import GateToggle from "./GateToggle";
import MilestoneComposer from "./MilestoneComposer";
import ReleaseWaitlist from "./ReleaseWaitlist";

export const dynamic = "force-dynamic";

function referrerLabel(type: string | null): string {
  if (type === "waitlist") return "Referred";
  if (type === "owner") return "Owner referral";
  if (type === "affiliate") return "Affiliate";
  return "Direct";
}

export default async function AdminWaitlistPage() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    redirect("/login");
  }

  const [registrationOpen, stats, leaderboard, signups, pendingReleaseCount] = await Promise.all([
    isRegistrationOpen(),
    getWaitlistAdminStats(),
    getWaitlistLeaderboard(10),
    listWaitlistForAdmin(200),
    getPendingReleaseCount(),
  ]);

  return (
    <div className="space-y-6 p-6 sm:p-8">
      {/* Gate control — the thing an admin comes here to do most */}
      <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60 mb-1">
            Registration gate
          </div>
          <p className="text-xs text-[var(--text-primary)]/50 max-w-md">
            {registrationOpen
              ? "New owners can register normally right now."
              : "New owners are redirected to the waitlist. Flipping this alone never sends any email."}
          </p>
        </div>
        <GateToggle registrationOpen={registrationOpen} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 px-5 py-4">
          <div className="text-2xl font-black text-[var(--text-primary)]">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-primary)]/50 mt-1">Total on waitlist</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 px-5 py-4">
          <div className="text-2xl font-black text-[var(--text-primary)]">{stats.last24h.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-primary)]/50 mt-1">Joined in last 24h</div>
        </div>
      </div>

      {/* Release the waitlist — separate, deliberate action */}
      <ReleaseWaitlist pendingCount={pendingReleaseCount} registrationOpen={registrationOpen} />

      {/* Milestone email */}
      <MilestoneComposer recipientCount={stats.total} />

      {/* Referral leaderboard */}
      <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 overflow-hidden">
        <div className="px-5 pt-4 pb-3 text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60">
          Referral leaderboard
        </div>
        {leaderboard.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-slate-500">No one has referred anyone in yet.</div>
        ) : (
          <div className="pb-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between px-5 py-2.5 text-sm border-t border-slate-200/5 first:border-t-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-[var(--text-primary)]/30 w-5 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{entry.fullName}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{entry.email}</div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-500 shrink-0">{entry.referralBoost} referred</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full list with survey answers */}
      <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 overflow-hidden">
        <div className="px-5 pt-4 pb-3 text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60">
          All signups ({signups.length}{signups.length === 200 ? "+" : ""})
        </div>
        <div className="hidden sm:grid grid-cols-[1.3fr_0.9fr_1fr_1fr_0.8fr_0.7fr] gap-2 px-5 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-t border-b border-slate-200/10">
          <span>Name / email</span>
          <span>Phone</span>
          <span>Location</span>
          <span>Sells</span>
          <span>Source</span>
          <span>Joined</span>
        </div>
        {signups.map((s) => (
          <div key={s.id} className="border-b border-slate-200/5 last:border-b-0">
            {/* Mobile: stacked card */}
            <div className="sm:hidden px-5 py-4 space-y-1.5">
              <div className="font-semibold text-[var(--text-primary)] truncate">{s.fullName}</div>
              <div className="text-xs text-slate-500 font-mono truncate">{s.email} · {s.phone}</div>
              <div className="text-xs text-[var(--text-primary)]/60">{s.state}, {s.lga}{s.sells ? ` · ${s.sells}` : ""}</div>
              <div className="text-xs text-slate-500">{referrerLabel(s.referredByType)} · {s.createdAt.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</div>
            </div>

            {/* Tablet/desktop: table row */}
            <div className="hidden sm:grid grid-cols-[1.3fr_0.9fr_1fr_1fr_0.8fr_0.7fr] gap-2 px-5 py-3 items-center text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] truncate">{s.fullName}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{s.email}</div>
              </div>
              <span className="text-xs font-mono">{s.phone}</span>
              <span className="text-xs truncate">{s.state}, {s.lga}</span>
              <span className="text-xs truncate">{s.sells || "—"}</span>
              <span className="text-xs">{referrerLabel(s.referredByType)}</span>
              <span className="text-xs font-mono text-slate-500">{s.createdAt.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}