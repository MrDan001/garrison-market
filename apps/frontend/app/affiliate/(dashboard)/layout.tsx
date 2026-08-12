// FILE: apps/frontend/app/affiliate/(dashboard)/layout.tsx
//
// MOVE THIS FILE HERE — replacing the old app/affiliate/layout.tsx, which
// wrapped /affiliate/login and /affiliate/register too and caused an
// infinite redirect loop (guard sends you to /affiliate/login, which is
// itself inside the guarded layout, which sends you to /affiliate/login...).
//
// The (dashboard) folder is a Next.js "route group" — parentheses mean
// it doesn't add a URL segment, so /affiliate/(dashboard)/page.tsx is
// still just /affiliate, and /affiliate/(dashboard)/payouts/page.tsx is
// still /affiliate/payouts. It ONLY changes which layout wraps them.
//
// REQUIRED FILE MOVES (all your existing files, just relocated):
//   app/affiliate/page.tsx              -> app/affiliate/(dashboard)/page.tsx
//   app/affiliate/AffiliateNav.tsx      -> app/affiliate/(dashboard)/AffiliateNav.tsx
//   app/affiliate/CopyLinkButton.tsx    -> app/affiliate/(dashboard)/CopyLinkButton.tsx
//   app/affiliate/EarningsChart.tsx     -> app/affiliate/(dashboard)/EarningsChart.tsx
//   app/affiliate/referrals/            -> app/affiliate/(dashboard)/referrals/
//   app/affiliate/promote/              -> app/affiliate/(dashboard)/promote/
//   app/affiliate/payouts/              -> app/affiliate/(dashboard)/payouts/
//   app/affiliate/settings/             -> app/affiliate/(dashboard)/settings/
//
// LEAVE THESE WHERE THEY ARE (outside the route group, unguarded):
//   app/affiliate/login/page.tsx
//   app/affiliate/register/page.tsx
//
// If any of those moved files import a sibling with a relative path like
// "../CopyLinkButton" or "./AffiliateNav", those still work as-is since
// the whole folder moved together — only the imports FROM page.tsx that
// reference "../CopyLinkButton" (going up out of dashboard) would break,
// and none of yours do that.

import { redirect } from "next/navigation";
import { getAffiliateSession } from "@/lib/affiliate-auth";
import AffiliateNav from "./AffiliateNav";

export default async function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  const affiliate = await getAffiliateSession();

  if (!affiliate) {
    redirect("/affiliate/login");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans">
      <AffiliateNav fullName={affiliate!.fullName} />
      <main className="max-w-5xl mx-auto px-5 sm:px-7 pb-24 sm:pb-16">{children}</main>
    </div>
  );
}