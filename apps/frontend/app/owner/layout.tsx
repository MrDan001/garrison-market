import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBillingStatus } from "@/lib/subscription-guard";
import prisma from "@/lib/prisma";
import { BusinessCurrencyProvider } from "@/components/BusinessCurrencyProvider";
import TrialTopBar from "@/components/TrialTopBar";
import OwnerSupportBubble from "@/components/OwnerSupportBubble";
import AdminAnnouncementGate from "@/components/AdminAnnouncementGate";
import PushPermissionGate, { IOSInstallNudge } from "@/components/PushPermissionGate";
import SpeakOn from "@/components/SpeakOn";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session?.email || session.role !== "owner") redirect("/login");

  const [billingStatus, ownerProfile] = await Promise.all([
    getBillingStatus(session.id),
    prisma.user.findUnique({ where: { id: session.id }, select: { currencyCode: true } }),
  ]);

  return (
    <BusinessCurrencyProvider currencyCode={ownerProfile?.currencyCode || "NGN"}>
      <PushPermissionGate>
        <TrialTopBar isLocked={billingStatus.isLocked} subscriptionStatus={billingStatus.subscriptionStatus} trialDaysLeft={billingStatus.trialDaysLeft} />
        {children}
        <SpeakOn role="owner" />
        <OwnerSupportBubble currentUserId={session.id} />
        <AdminAnnouncementGate />
        <IOSInstallNudge />
      </PushPermissionGate>
    </BusinessCurrencyProvider>
  );
}