// FILE: apps/frontend/app/affiliate/(dashboard)/AffiliateNav.tsx

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Share2, Wallet, Settings2 } from "lucide-react";
import { logoutAffiliateAction } from "@/lib/affiliate.actions";

const TABS = [
  { href: "/affiliate", label: "Overview" },
  { href: "/affiliate/referrals", label: "Referrals" },
  { href: "/affiliate/promote", label: "Promote" },
  { href: "/affiliate/payouts", label: "Payouts" },
  { href: "/affiliate/settings", label: "Settings" },
];

// Same shape as the bottom nav on /staff/dashboard: icon-over-label tabs,
// with the "hero" action (Promote — the affiliate's actual job) raised
// in a circle in the middle, same as SELL is on the staff bar.
const MOBILE_TABS = [
  { href: "/affiliate", label: "Overview", icon: LayoutDashboard },
  { href: "/affiliate/referrals", label: "Referrals", icon: Users },
  { href: "/affiliate/promote", label: "Promote", icon: Share2, hero: true },
  { href: "/affiliate/payouts", label: "Payouts", icon: Wallet },
  { href: "/affiliate/settings", label: "Settings", icon: Settings2 },
];

export default function AffiliateNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    const result = await logoutAffiliateAction();
    if (result?.redirectUrl) router.push(result.redirectUrl);
  }

  return (
    <>
      {/* Top bar — simplified on mobile since tabs move to the bottom bar */}
      <nav className="sticky top-0 z-40 w-full bg-[var(--text-primary)] text-[var(--bg-app)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-7 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-extrabold tracking-tight text-sm sm:text-base truncate" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
              Garrison<span className="inline-block w-[6px] h-[6px] rounded-full bg-[#E8A33D] mx-1 align-middle" />Market
            </span>
            <span className="hidden xs:inline text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest opacity-60 ml-1 flex-shrink-0" style={{ fontFamily: "var(--font-mono, monospace)" }}>
              Affiliate
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`pb-[19px] pt-[19px] border-b-2 transition-colors ${
                    active ? "border-[#E8A33D] opacity-100" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#E8A33D] text-[var(--text-primary)] flex items-center justify-center text-[11px] sm:text-xs font-bold flex-shrink-0">
              {initials || "A"}
            </div>
            <button
              onClick={handleLogout}
              className="hidden sm:inline text-xs font-semibold opacity-60 hover:opacity-100 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom bar — mobile only, same pattern as /staff/dashboard's bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-app)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)]/15 px-4 py-2 z-50">
        <div className="flex items-end justify-around max-w-md mx-auto">
          {MOBILE_TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;

            if (tab.hero) {
              return (
                <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 -mt-6">
                  <div
                    className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-[var(--bg-app)] ${
                      active ? "bg-gradient-to-br from-[#E8A33D] to-[#C77D2E] shadow-[#E8A33D]/30" : "bg-[var(--text-primary)] shadow-black/20"
                    }`}
                  >
                    <Icon size={26} className={active ? "text-[var(--text-primary)]" : "text-[var(--bg-app)]"} />
                  </div>
                  <span className={`text-[10px] font-bold mt-0.5 ${active ? "text-[#E8A33D]" : "opacity-60"}`}>{tab.label}</span>
                </Link>
              );
            }

            return (
              <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 py-2 px-3 group">
                <div className="h-6 w-6 flex items-center justify-center">
                  <Icon size={22} className={active ? "text-[#E8A33D]" : "opacity-50"} />
                </div>
                <span className={`text-[10px] ${active ? "text-[#E8A33D] font-semibold" : "opacity-50"}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}