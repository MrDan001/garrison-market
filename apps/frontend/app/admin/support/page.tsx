import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { getAdminThreads, getAdminStaffThreads } from "@/lib/support.actions";
import AdminSupportClient from "./admin-support-client";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const [ownerThreads, staffThreads] = await Promise.all([
    getAdminThreads(),
    getAdminStaffThreads(),
  ]);

  return (
    <AdminSupportClient
      currentUserId={session.id}
      ownerThreads={JSON.parse(JSON.stringify(ownerThreads))}
      staffThreads={JSON.parse(JSON.stringify(staffThreads))}
    />
  );
}