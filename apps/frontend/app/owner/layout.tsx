import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBillingStatus } from "@/lib/subscription-guard";
import TrialTopBar from "@/components/TrialTopBar";
import OwnerSupportBubble from "@/components/OwnerSupportBubble";
import AdminAnnouncementGate from "@/components/AdminAnnouncementGate";
import PushPermissionGate, { IOSInstallNudge } from "@/components/PushPermissionGate";

/**
 * Wraps every page under /owner/* (dashboard, inventory, staff, reports,
 * billing, etc). Renders the red free-trial countdown bar automatically so
 * it never has to be added page-by-page again.
 *
 * Individual owner pages keep their own auth/approval redirects — this
 * layout only adds a lightweight session check (so the bar never renders
 * for a logged-out request) plus the billing status lookup for the bar.
 *
 * PushPermissionGate sits directly under the session check, above
 * everything else — it blocks {children} entirely until notification
 * permission is resolved, so owners can't reach any /owner/* page (or the
 * trial bar / support bubble / announcement pop-up) without it. See that
 * component for exactly which states it blocks vs pass through.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session?.email) {
    redirect("/login");
  }

  if (session.role !== "owner") {
    redirect("/login");
  }

  const billingStatus = await getBillingStatus(session.id);

  return (
    <PushPermissionGate>
      <TrialTopBar
        isLocked={billingStatus.isLocked}
        subscriptionStatus={billingStatus.subscriptionStatus}
        trialDaysLeft={billingStatus.trialDaysLeft}
      />
      {children}
      <OwnerSupportBubble currentUserId={session.id} />
      <AdminAnnouncementGate />
      <IOSInstallNudge />
    </PushPermissionGate>
  );
}