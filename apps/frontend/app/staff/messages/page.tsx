// FILE: apps/frontend/app/staff/messages/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getMessagesForStaff } from "@/lib/admin-message.actions";
import StaffMessagesListClient from "./staff-messages-list-client";

export const dynamic = "force-dynamic";

export default async function StaffMessagesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const messages = await getMessagesForStaff();

  return <StaffMessagesListClient messages={messages} />;
}