import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getAdminIntakeInbox } from "@/lib/support-intake.actions";
import AdminSupportClient from "./admin-support-client";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const inbox = await getAdminIntakeInbox();

  return (
    <AdminSupportClient
      currentUserId={session.id}
      inbox={inbox}
    />
  );
}