import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import PushPermissionGate, { IOSInstallNudge } from "@/components/PushPermissionGate";
import prisma from "@/lib/prisma";
import { BusinessCurrencyProvider } from "@/components/BusinessCurrencyProvider";
import SpeakOn from "@/components/SpeakOn";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session?.email || session.role !== "staff") redirect("/login");

  const staffProfile = await prisma.user.findUnique({ where: { id: session.id }, select: { ownerId: true } });
  const ownerProfile = staffProfile?.ownerId
    ? await prisma.user.findUnique({ where: { id: staffProfile.ownerId }, select: { currencyCode: true } })
    : null;

  return (
    <BusinessCurrencyProvider currencyCode={ownerProfile?.currencyCode || "NGN"}>
      <PushPermissionGate>
        {children}
        <SpeakOn role="staff" />
        <IOSInstallNudge />
      </PushPermissionGate>
    </BusinessCurrencyProvider>
  );
}