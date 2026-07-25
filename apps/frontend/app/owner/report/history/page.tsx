// FILE: apps/frontend/app/owner/report/history/page.tsx

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
    include: { author: true, items: { include: { inventory: true } }, scaleItems: true },
  });

  // Same fix as the pending-reports page — a merged store's report can
  // have both list and scale items on the same row. Both are kept as
  // separate arrays now instead of one silently overwriting the other.
  const withReshapedItems = historyReports.map((report) => ({
    ...report,
    listItems: report.items.map((item) => ({
      id: item.id,
      name: item.inventory?.name ?? item.name ?? "Unknown Item",
      price: Number(item.price),
      quantity: item.quantity,
      total: Number(item.total),
      discountValue: item.discountValue != null ? Number(item.discountValue) : null,
      discountType: item.discountType,
      discountReason: item.discountReason,
    })),
    scaleItems: report.scaleItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.quantitySold) > 0 ? Number(item.totalPrice) / Number(item.quantitySold) : 0,
      quantity: `${Number(item.quantitySold)}${item.unit}`,
      total: Number(item.totalPrice),
      discountValue: null,
      discountType: null,
      discountReason: null,
    })),
  }));

  const serialized = JSON.parse(JSON.stringify(withReshapedItems));

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