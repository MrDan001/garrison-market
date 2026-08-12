// FILE: apps/frontend/app/affiliate/settings/page.tsx

import { getAffiliateSession } from "@/lib/affiliate-auth";
import prisma from "@/lib/prisma";
import SettingsForm from "./SettingsForm";

export default async function AffiliateSettingsPage() {
  const session = await getAffiliateSession();
  if (!session) return null;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: session.id },
    select: {
      email: true,
      fullName: true,
      phoneNumber: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
    },
  });

  if (!affiliate) return null;

  return (
    <div className="pt-6 max-w-lg">
      <h1 className="text-lg font-bold mb-1">Settings</h1>
      <p className="text-sm opacity-60 mb-5">Your bank details are used for payouts — keep them current.</p>
      <SettingsForm affiliateId={session.id} affiliate={affiliate} />
    </div>
  );
}