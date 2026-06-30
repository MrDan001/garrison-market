import db from "@/lib/prisma";
import HistoryClientList from "@/components/HistoryList";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function HistoryPage() {
  const historyReports = await db.report.findMany({
    where: { status: { in: ["approved", "declined"] } },
    orderBy: { date: "desc" },
    include: { author: true }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/owner/report"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 transition-colors shrink-0"
              title="Back to Reports"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Report History
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-tight">
                All finalized staff reports
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <HistoryClientList reports={historyReports || []} />
      </div>
    </div>
  );
}
