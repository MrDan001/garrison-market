// FILE: apps/frontend/app/admin/messages/[id]/page.tsx

import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getAdminMessageWithRecipients } from "@/lib/admin-message.actions";
import MessageThreadsClient from "./message-threads-client";

export const dynamic = "force-dynamic";

export default async function AdminMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const { id } = await params;
  const messageId = parseInt(id, 10);
  if (Number.isNaN(messageId)) notFound();

  const data = await getAdminMessageWithRecipients(messageId);
  if (!data) notFound();

  return <MessageThreadsClient message={data.message} initialThreads={data.threads} />;
}