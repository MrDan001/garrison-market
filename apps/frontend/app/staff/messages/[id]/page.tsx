// FILE: apps/frontend/app/staff/messages/[id]/page.tsx

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth.actions";
import { getMessageForStaff } from "@/lib/admin-message.actions";
import { ArrowLeft, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import StaffAcknowledgeButton from "./staff-acknowledge-button";

export const dynamic = "force-dynamic";

export default async function StaffMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const { id } = await params;
  const messageId = parseInt(id, 10);
  if (Number.isNaN(messageId)) notFound();

  const message = await getMessageForStaff(messageId);
  if (!message) notFound();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/staff/messages" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back to Messages
        </Link>

        <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold uppercase tracking-wider">
                <Mail size={13} /> Message from the Admin Desk
              </div>
              {message.isAcknowledged && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 size={13} /> Acknowledged
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{message.subject}</h1>
            <p className="text-xs text-slate-500 mt-1.5">
              {new Date(message.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>

          <div className="p-5 sm:p-6 space-y-4 border-b border-slate-200/60 dark:border-slate-800/60">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{message.body}</p>

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

          <div className="p-5 sm:p-6">
            <StaffAcknowledgeButton messageId={message.id} isAcknowledged={message.isAcknowledged} />
          </div>
        </div>
      </div>
    </div>
  );
}