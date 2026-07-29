// FILE: apps/frontend/app/owner/messages/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getMessagesForOwner } from "@/lib/admin-message.actions";
import MessagesListClient from "./messages-list-client";

export const dynamic = "force-dynamic";

export default async function OwnerMessagesPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const messages = await getMessagesForOwner();

  return <MessagesListClient messages={messages} />;
}