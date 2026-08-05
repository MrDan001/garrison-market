// FILE: apps/frontend/app/owner/messages/[id]/page.tsx

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth.actions";
import { getOwnerMessageThread } from "@/lib/admin-message.actions";
import { ArrowLeft, Mail, ExternalLink } from "lucide-react";
import OwnerThreadClient from "./owner-thread-client";
import OwnerAcknowledgeButton from "./owner-acknowledge-button";
import MessageBody from "@/components/MessageBody";

export const dynamic = "force-dynamic";

export default async function OwnerMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const { id } = await params;
  const messageId = parseInt(id, 10);
  if (Number.isNaN(messageId)) notFound();

  // getOwnerMessageThread both verifies this owner is actually a recipient
  // AND marks it read (upsert AdminMessageRead) — opening this page is
  // the read action, same as opening a normal email — plus loads any
  // back-and-forth already on this owner's thread.
  const data = await getOwnerMessageThread(messageId);
  if (!data) notFound();
  const { message, replies } = data;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/owner/messages" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back to Messages
        </Link>

        <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold uppercase tracking-wider">
                <Mail size={13} /> Garrison Market
              </div>
              <OwnerAcknowledgeButton messageId={message.id} isAcknowledged={message.isAcknowledged} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{message.subject}</h1>
            <p className="text-xs text-slate-500 mt-1.5">
              {new Date(message.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>

          <div className="p-5 sm:p-6 space-y-4 border-b border-slate-200/60 dark:border-slate-800/60">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              <MessageBody text={message.body} />
            </p>

            {message.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.imageUrl} alt="" className="w-full rounded-xl border border-slate-200 dark:border-slate-800" />
            )}

            {message.link && (
              <a
                href={message.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Open Link <ExternalLink size={14} />
              </a>
            )}
          </div>

          <OwnerThreadClient messageId={message.id} channel={message.channel} initialReplies={replies} />
        </div>
      </div>
    </div>
  );
}