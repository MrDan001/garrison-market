"use client";

import React, { useState } from "react";
import { updateReportStatus, requestReportRevision } from "@/lib/business.actions";
import {
  ClipboardList,
  Check,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function ReportsReviewClient({
  initialReports,
}: {
  initialReports: any[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>({});

  // States for requesting a revision
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    // Reset revision state for this card if it gets closed
    if (correctingId === id) {
      setCorrectingId(null);
      setCorrectionNote("");
    }
  };

  const handleStatusUpdate = async (
    reportId: number,
    status: "approved" | "declined"
  ) => {
    setProcessingId(reportId);
    try {
      await updateReportStatus(reportId, status);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Something went wrong updating the report.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequestRevision = async (reportId: number) => {
    if (!correctionNote.trim()) {
      alert("Please explain what needs correcting.");
      return;
    }
    setSubmittingCorrection(true);
    try {
      await requestReportRevision(reportId, correctionNote);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setCorrectingId(null);
      setCorrectionNote("");
    } catch (error) {
      console.error(error);
      alert("Something went wrong sending this back for correction.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">

      {/* ── Top Header ── */}
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/owner/dashboard"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-surface)] hover:bg-slate-200 hover:dark:bg-slate-800 active:bg-slate-300 active:dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm shrink-0">
                <ClipboardList size={17} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight truncate">
                  Staff Reports
                </h1>
                <p className="hidden sm:block text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                  Review submitted daily reports
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/owner/report/history"
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-full text-[11px] sm:text-xs font-semibold hover:bg-blue-500 active:scale-95 transition-all shrink-0"
          >
            <span className="hidden sm:inline">View </span>History
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 pb-24">

        {reports.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 sm:p-14 text-center shadow-sm mt-4">
            <ClipboardList size={38} className="mx-auto mb-3 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">All caught up!</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              No pending staff reports to review right now.
            </p>
          </div>
        ) : (
          reports.map((report) => {
            const staffName = report.author?.fullName || "Staff Member";
            const reportDate = report.date
              ? new Date(report.date).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Today";
            const isExpanded = !!expandedRows[report.id];
            const items = report.items || [];
            const isCorrectingThisOne = correctingId === report.id;

            return (
              <div
                key={report.id}
                className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* ── Card Header ── */}
                <div
                  onClick={() => toggleRow(report.id)}
                  className="px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--bg-surface)] active:bg-[var(--bg-surface)] transition-colors select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-blue-400 font-bold text-sm shadow-inner">
                      {staffName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {staffName}
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} />
                        {reportDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pending
                    </span>
                    <div className="text-slate-600 dark:text-slate-400 p-1 rounded-lg hover:bg-slate-200 hover:dark:bg-slate-800 transition-colors">
                      {isExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded Panel ── */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-[var(--bg-app)] animate-fadeIn">

                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">

                      {/* LEFT — Report Table + Notes */}
                      <div className="md:col-span-7 space-y-3">
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Report Narrative
                          </h4>
                          <span className="text-[10px] text-slate-400 dark:text-slate-600 block mt-0.5">
                            Staff Submitted Breakdown
                          </span>
                        </div>

                        {/* Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-[var(--bg-surface)]">
                                <th className="p-2.5 sm:p-3">Item</th>
                                <th className="p-2.5 sm:p-3 text-center">Price</th>
                                <th className="p-2.5 sm:p-3 text-center">Qty</th>
                                <th className="p-2.5 sm:p-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 divide-y divide-slate-800/40 font-medium">
                              {items.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-slate-500">
                                    No items captured in snapshot.
                                  </td>
                                </tr>
                              ) : (
                                items.map((item: any) => (
                                  <tr key={item.id}>
                                    <td className="p-2.5 sm:p-3 text-slate-800 dark:text-slate-200 max-w-[100px] sm:max-w-none truncate">
                                      <span className="flex items-center gap-1.5">
                                        {item.name}
                                        {item.discountValue != null && (
                                          <span
                                            title={item.discountReason ?? "Discount applied"}
                                            className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold"
                                          >
                                            -{item.discountType === "percent" ? `${item.discountValue}%` : `₦${Number(item.discountValue).toLocaleString()}`}
                                          </span>
                                        )}
                                      </span>
                                      {item.discountReason && (
                                        <span className="block text-[10px] text-slate-500 mt-0.5">{item.discountReason}</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 sm:p-3 text-center text-slate-600 dark:text-slate-400">
                                      ₦{Number(item.price).toLocaleString()}
                                    </td>
                                    <td className="p-2.5 sm:p-3 text-center font-bold text-blue-400">
                                      {item.quantity}
                                    </td>
                                    <td className="p-2.5 sm:p-3 text-right font-bold text-[var(--text-primary)]">
                                      ₦{Number(item.total).toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Notes */}
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">
                          Staff Feedback & Comments
                        </label>
                        <div className="p-3 min-h-[56px] bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                          {report.notes}
                        </div>
                      </div>

                     {/* RIGHT — Verification Card */}
<div className="md:col-span-5 bg-gradient-to-br from-[#141829] to-[#0d0f18] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-inner">
  <div>
    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
      <ShieldCheck size={12} /> Financial Breakdown
    </span>

    <div className="grid grid-cols-2 gap-2.5 mb-3">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
        <p className="text-[10px] text-emerald-400 font-bold uppercase">💵 Cash</p>
        <p className="text-lg font-black text-[var(--text-primary)] mt-1">₦{report.cashTotal.toLocaleString()}</p>
      </div>
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <p className="text-[10px] text-blue-400 font-bold uppercase">🏦 Transfer</p>
        <p className="text-lg font-black text-[var(--text-primary)] mt-1">₦{report.transferTotal.toLocaleString()}</p>
      </div>
    </div>

    <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Total Sales</span>
      <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight block mt-1">
        ₦{Number(report.totalSales).toLocaleString()}
      </span>
    </div>
  </div>

  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-start gap-1.5 text-[10px] sm:text-[11px] text-slate-500 leading-normal">
    <AlertCircle size={12} className="text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
    <span>Match this against your actual cash count and bank transfers before approving.</span>
  </div>
</div>

                      {/* Revision Input Box (conditionally shown if Revision requested) */}
                      {isCorrectingThisOne && (
                        <div className="col-span-1 md:col-span-12 p-4 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl mt-3 animate-fadeIn">
                          <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">
                            Reason for Correction Request
                          </label>
                          <textarea
                            value={correctionNote}
                            onChange={(e) => setCorrectionNote(e.target.value)}
                            placeholder="State clearly what needs to be changed..."
                            rows={3}
                            className="w-full bg-[var(--bg-app)] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={() => {
                                setCorrectingId(null);
                                setCorrectionNote("");
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRequestRevision(report.id)}
                              disabled={submittingCorrection}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {submittingCorrection ? "Sending..." : "Submit Request"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Row */}
                      <div className="col-span-1 md:col-span-12 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Request Revision Button (Triggers input drawer above) */}
                        {!isCorrectingThisOne && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCorrectingId(report.id);
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-400/90 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl transition-all w-full sm:w-auto"
                          >
                            <RotateCcw size={13} />
                            Needs Correction
                          </button>
                        )}
                        <div className="hidden sm:block flex-1" />

                        <div className="w-full grid grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(report.id, "declined");
                            }}
                            disabled={processingId !== null}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-transparent border border-slate-300 dark:border-slate-700 hover:border-rose-500 active:border-rose-500 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-400 active:text-rose-400 transition-all duration-150 disabled:opacity-50"
                          >
                            <X size={13} />
                            Decline Report
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(report.id, "approved");
                            }}
                            disabled={processingId !== null}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/20 hover:shadow-lg transition-all duration-150 disabled:opacity-50"
                          >
                            <Check size={13} />
                            Approve & Log
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}