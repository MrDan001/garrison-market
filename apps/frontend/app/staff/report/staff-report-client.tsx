// FILE: apps/frontend/app/staff/report/staff-report-client.tsx

"use client";

import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDailyReport } from "@/lib/business.actions";
import { FileText, Clock, ChevronDown, ChevronUp, ArrowLeft, List, Scale as ScaleIcon } from "lucide-react";
import { resubmitReportAction } from "@/lib/business.actions";

// Stage 4: a merged store (standard store + the admin-only
// scaleConsignmentEnabled override) now shows a List/Scale toggle above
// today's sales summary instead of only ever showing List sales. A
// store that's only ever one type (native scale-only, or standard
// without the override) never shows the toggle — same single view as
// before, just driven by hasList/hasScale instead of the old isScale
// flag.
export default function StaffReportClient({ staffId, reports, sales, pendingRevision, hasList, hasScale, scaleSummary }: any) {
  const { formatCurrency } = useBusinessCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const allSoldItems = hasList ? sales.flatMap((s: any) => s.items ?? []) : [];
  const totalValue = sales.reduce((sum: number, s: any) => sum + Number(s.total), 0);

  const isMerged = !!hasList && !!hasScale;
  const [view, setView] = useState<"list" | "scale">(hasList ? "list" : "scale");
  const activeView = isMerged ? view : hasList ? "list" : "scale";

  const listTotal = allSoldItems.reduce((sum: number, item: any) => sum + Number(item.priceAtTime) * item.quantity, 0);
  const scaleTotal = (scaleSummary || []).reduce((sum: number, g: any) => sum + g.total, 0);

  const [clarification, setClarification] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!complaint.trim()) {
      alert("Please enter your report notes before submitting.");
      return;
    }

    setLoading(true);

    try {
      // submitDailyReport derives totals/items itself from Order/OrderItem —
      // just pass the staff's actual typed notes, no string-building needed.
      await submitDailyReport(staffId, complaint.trim());
      setComplaint("");
      window.location.reload();
    } catch (e) {
      alert("Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!clarification.trim()) {
      alert("Please add a note explaining the correction.");
      return;
    }
    setResubmitting(true);
    try {
      await resubmitReportAction(pendingRevision.id, clarification);
      setClarification("");
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "Failed to resubmit.");
    } finally {
      setResubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case 'declined': return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default: return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 px-4 sm:px-6 py-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors mb-2"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      {pendingRevision && (
  <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
        <span className="text-lg">⚠️</span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-amber-300">A report needs correction</h3>
        <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">{pendingRevision.ownerNote}</p>
      </div>
    </div>
    <textarea
      value={clarification}
      onChange={(e) => setClarification(e.target.value)}
      placeholder="Explain or clarify here..."
      className="w-full h-20 bg-[var(--bg-app)] border border-amber-500/20 rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 transition-colors resize-none"
    />
    <button
      onClick={handleResubmit}
      disabled={resubmitting}
      className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
    >
      {resubmitting ? "Resubmitting..." : "Resubmit Report"}
    </button>
  </div>
)}

      {/* Sales Header */}
      <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-lg">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Total Sales Today</p>
        <h1 className="text-3xl sm:text-5xl font-bold text-[var(--text-primary)] mt-2">{formatCurrency(totalValue)}</h1>
        {isMerged && (
          <p className="text-xs text-slate-500 mt-2">
            List {formatCurrency(listTotal)} · Scale {formatCurrency(scaleTotal)}
          </p>
        )}
      </div>

      {/* Main Report Form */}
      <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-5 sm:mb-6">Daily Summary & Submission</h2>

        <div className="space-y-5 sm:space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              {activeView === "scale" ? "Amount Sold (Per Product)" : "Itemized List"}
            </label>

            {isMerged && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    activeView === "list" ? "bg-blue-600 text-white" : "bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <List size={13} /> List · {formatCurrency(listTotal)}
                </button>
                <button
                  type="button"
                  onClick={() => setView("scale")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    activeView === "scale" ? "bg-blue-600 text-white" : "bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <ScaleIcon size={13} /> Scale · {formatCurrency(scaleTotal)}
                </button>
              </div>
            )}

            {activeView === "scale" ? (
              <>
                {/* Mobile: stacked cards — "Rice: 12kg — ₦24,000" style */}
                <div className="sm:hidden space-y-2">
                  {scaleSummary.length === 0 && (
                    <p className="text-slate-400 dark:text-slate-600 text-sm italic p-3">No sales yet today.</p>
                  )}
                  {scaleSummary.map((g: any, idx: number) => (
                    <div key={idx} className="bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{g.name}</p>
                        <p className="text-xs text-slate-500">{g.qty}{g.unit} sold</p>
                      </div>
                      <span className="font-bold text-[var(--text-primary)] text-sm shrink-0 ml-3">
                        {formatCurrency(g.total)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3 px-2">Item</th>
                        <th className="pb-3 px-2">Amount Sold</th>
                        <th className="pb-3 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scaleSummary.map((g: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                          <td className="py-3 px-2">{g.name}</td>
                          <td className="py-3 px-2">{g.qty}{g.unit}</td>
                          <td className="py-3 px-2 font-bold text-[var(--text-primary)]">{formatCurrency(g.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="sm:hidden space-y-2">
                  {allSoldItems.length === 0 && (
                    <p className="text-slate-400 dark:text-slate-600 text-sm italic p-3">No sales yet today.</p>
                  )}
                  {allSoldItems.map((item: any, idx: number) => (
                    <div key={idx} className="bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{item.inventory?.name || "N/A"}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(Number(item.priceAtTime))} × {item.quantity}</p>
                      </div>
                      <span className="font-bold text-[var(--text-primary)] text-sm shrink-0 ml-3">
                        {formatCurrency(Number(item.priceAtTime) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3 px-2">Item</th>
                        <th className="pb-3 px-2">Price</th>
                        <th className="pb-3 px-2">Qty</th>
                        <th className="pb-3 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSoldItems.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                          <td className="py-3 px-2">{item.inventory?.name || "N/A"}</td>
                          <td className="py-3 px-2">{formatCurrency(Number(item.priceAtTime))}</td>
                          <td className="py-3 px-2">{item.quantity}</td>
                          <td className="py-3 px-2 font-bold text-[var(--text-primary)]">{formatCurrency(Number(item.priceAtTime) * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <textarea
            className="w-full h-24 bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition-colors"
            placeholder="Type your notes here..."
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98]"
          >
            {loading ? "Submitting..." : "Submit Full Daily Report"}
          </button>
        </div>
      </div>

      {/* History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full py-4 flex items-center justify-center gap-2 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl font-semibold text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-all active:scale-[0.98]"
      >
        {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        {showHistory ? "Hide Report History" : "View Report History"}
      </button>

      {/* History List */}
      {showHistory && (
        <div className="space-y-3 animate-in fade-in duration-500">
          {reports.length === 0 && (
            <p className="text-slate-400 dark:text-slate-600 text-sm italic text-center py-4">No reports submitted today.</p>
          )}
          {reports.map((r: any) => (
            <div key={r.id} className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight line-clamp-3 sm:line-clamp-none">{r.notes}</p>
                  <p className="text-[9px] text-slate-500 mt-1"><Clock size={10} className="inline mr-1" /> {new Date(r.date).toLocaleTimeString()}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-[9px] font-bold border shrink-0 ${getStatusStyle(r.status)}`}>
                {r.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
