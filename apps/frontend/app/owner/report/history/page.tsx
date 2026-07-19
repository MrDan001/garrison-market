import prisma from "@/lib/prisma";
import HistoryClientList from "@/components/HistoryList";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.role.toLowerCase() !== "owner") redirect("/login");

  const activeStoreId = await getActiveStoreId();

  const historyReports = await prisma.report.findMany({
    where: {
      ownerId: session.id,
      status: { in: ["approved", "declined"] },
      OR: [{ storeId: activeStoreId }, { storeId: null }],
    },
    orderBy: { date: "desc" },
    include: { author: true, items: true }
  });

  const serialized = JSON.parse(JSON.stringify(historyReports));

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      {/* ── Top Header ── */}
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/owner/report"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
              title="Back to Reports"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
                Report History
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-500 leading-tight">
                All finalized staff reports
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {serialized.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 rounded-3xl bg-[var(--bg-surface)]">
            No approved or declined reports yet.
          </div>
        ) : (
          <HistoryClientList reports={serialized} />
        )}
      </div>
    </div>
  );
}