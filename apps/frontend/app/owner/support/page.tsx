import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getOwnerStaffThreads, getOwnerAdminThread } from "@/lib/support.actions";
import { getIntakeContext } from "@/lib/support-intake.actions";
import OwnerSupportClient from "./owner-support-client";

export const dynamic = "force-dynamic";

export default async function OwnerSupportPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const [staffThreads, adminThread, adminIntake] = await Promise.all([
    getOwnerStaffThreads(),
    getOwnerAdminThread(),
    getIntakeContext("owner_admin"),
  ]);

  return (
    <OwnerSupportClient
      currentUserId={session.id}
      staffThreads={JSON.parse(JSON.stringify(staffThreads))}
      adminMessages={JSON.parse(JSON.stringify(adminThread.messages))}
      adminIntake={JSON.parse(JSON.stringify(adminIntake))}
    />
  );
}