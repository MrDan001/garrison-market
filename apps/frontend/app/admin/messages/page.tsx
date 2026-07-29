// FILE: apps/frontend/app/admin/messages/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getOwnersForAdminPicker, getSentAdminMessages } from "@/lib/admin-message.actions";
import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const [owners, sent] = await Promise.all([
    getOwnersForAdminPicker(),
    getSentAdminMessages(),
  ]);

  return <MessagesClient owners={owners} initialSent={sent} />;
}