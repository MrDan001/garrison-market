// FILE: apps/frontend/app/admin/messages/staff/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getStaffForAdminPicker, getSentAdminMessages } from "@/lib/admin-message.actions";
import StaffMessagesClient from "./staff-messages-client";

export const dynamic = "force-dynamic";

export default async function AdminStaffMessagesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const [staff, sent] = await Promise.all([
    getStaffForAdminPicker(),
    getSentAdminMessages(),
  ]);

  // This route only cares about messages that were actually sent to staff
  // — owner-audience sends still show on /admin/messages, not here.
  const sentToStaff = sent.filter((m: (typeof sent)[number]) => m.audience === "all_staff" || m.audience === "single_staff");

  return <StaffMessagesClient staff={staff} initialSent={sentToStaff} />;
}