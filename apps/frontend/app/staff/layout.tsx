// FILE: apps/frontend/app/staff/layout.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import PushPermissionGate, { IOSInstallNudge } from "@/components/PushPermissionGate";
import prisma from "@/lib/prisma";
import { BusinessCurrencyProvider } from "@/components/BusinessCurrencyProvider";

/**
 * Wraps every page under /staff/* (dashboard, inventory, orders, reports,
 * etc). Didn't exist before this — each staff page previously did its own
 * auth check independently with no shared wrapper.
 *
 * Deliberately minimal, same philosophy as app/owner/layout.tsx: only a
 * lightweight session + role check here (so the gate never renders for a
 * logged-out request). Status handling (suspended/pending redirects) stays
 * on individual pages, since some of them apply slightly different logic
 * there — this layout doesn't try to replace that.
 *
 * PushPermissionGate blocks {children} — every /staff/* page — until
 * notification permission is resolved. Previously AdminAnnouncementGate
 * only sat on /staff/dashboard, meaning a staff member deep-linking
 * straight into e.g. /staff/inventory skipped it entirely; this layout
 * closes that gap for the push gate at least (AdminAnnouncementGate
 * itself is left as-is on the dashboard page, unrelated to this change).
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session?.email) {
    redirect("/login");
  }

  if (session.role !== "staff") {
    redirect("/login");
  }

  const staffProfile = await prisma.user.findUnique({ where: { id: session.id }, select: { ownerId: true } });
  const ownerProfile = staffProfile?.ownerId
    ? await prisma.user.findUnique({ where: { id: staffProfile.ownerId }, select: { currencyCode: true } })
    : null;

  return (
    <BusinessCurrencyProvider currencyCode={ownerProfile?.currencyCode || "NGN"}>
    <PushPermissionGate>
      {children}
      <IOSInstallNudge />
    </PushPermissionGate>
    </BusinessCurrencyProvider>
  );
}
