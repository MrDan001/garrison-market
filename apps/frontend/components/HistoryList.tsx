// FILE: apps/frontend/components/HistoryList.tsx

"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calendar, ShieldCheck, List, Scale as ScaleIcon } from "lucide-react";

// Stage 2: same fix/feature as ReportsReviewClient — a report can carry
// both listItems and scaleItems (merged stores). A small toggle appears
// only when a report genuinely has both; single-type reports render
// exactly as before, just reading from the new field names.
function ItemTypeToggle({
  view,
  onChange,
  listTotal,
  scaleTotal,
}: {
  view: "list" | "scale";
  onChange: (v: "list" | "scale") => void;
  listTotal: number;
  scaleTotal: number;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors ${
          view === "list" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}
      >
        <List size={12} /> List · ₦{listTotal.toLocaleString()}
      </button>
      <button
        type="button"
        onClick={() => onChange("scale")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors ${
          view === "scale" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}
      >
        <ScaleIcon size={12} /> Scale · ₦{scaleTotal.toLocaleString()}
      </button>
    </div>
  );
}

export default function HistoryList({ reports = [] }: { reports?: any[] }) {
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>({});
  const [itemView, setItemView] = useState<{ [key: number]: "list" | "scale" }>({});

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getActiveView = (report: any): "list" | "scale" => {
    const explicit = itemView[report.id];
    if (explicit) return explicit;
    return (report.listItems?.length ?? 0) > 0 ? "list" : "scale";
  };

  const safeReports = reports || [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {safeReports.length > 0 ? (
        safeReports.map((report) => {
          const isExpanded = !!expandedRows[report.id];
          const listItems = report.listItems || [];
          const scaleItems = report.scaleItems || [];
          const isMerged = listItems.length > 0 && scaleItems.length > 0;
          const activeView = getActiveView(report);
          const items = activeView === "scale" ? scaleItems : listItems;
          const listTotal = listItems.reduce((sum: number, i: any) => sum + Number(i.total), 0);
          const scaleTotal = scaleItems.reduce((sum: number, i: any) => sum + Number(i.total), 0);

          return (
            <div key={report.id} className="bg-white border border-slate-900 dark:border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div onClick={() => toggleRow(report.id)} className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-950/70 hover:dark:bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-slate-400 dark:text-slate-600 font-semibold">
                    {report.author?.fullName?.charAt(0) || "S"}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 dark:text-slate-800 flex items-center gap-1.5">
                      {report.author?.fullName || "Staff"}
                      {isMerged && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-500">
                          List + Scale
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={12} /> {new Date(report.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${report.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {report.status}
                  </span>
                  <div className="text-slate-600 dark:text-slate-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-900 bg-[var(--bg-app)] p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-7 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Report Narrative</h4>

                    {isMerged && (
                      <ItemTypeToggle
                        view={activeView}
                        onChange={(v) => setItemView((prev) => ({ ...prev, [report.id]: v }))}
                        listTotal={listTotal}
                        scaleTotal={scaleTotal}
                      />
                    )}

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                        <thead className="bg-[var(--bg-surface)] text-slate-600 dark:text-slate-400 uppercase">
                          <tr><th className="p-3">Item</th><th className="p-3 text-center">Price</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {items.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-slate-500">No items captured in snapshot.</td></tr>
                          ) : (
                            items.map((item: any) => (
                              <tr key={item.id}>
                                <td className="p-3">
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
                                <td className="p-3 text-center">₦{Number(item.price).toLocaleString()}</td>
                                <td className="p-3 text-center font-bold text-blue-400">{item.quantity}</td>
                                <td className="p-3 text-right font-bold text-[var(--text-primary)]">₦{Number(item.total).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mt-4">Staff Feedback</h4>
                    <div className="p-3 bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300">{report.notes}</div>
                  </div>

                  <div className="md:col-span-5 bg-gradient-to-br from-[#141829] to-[#0d0f18] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><ShieldCheck size={13} /> Finalized Audit</span>

                    {isMerged && (
                      <div className="grid grid-cols-2 gap-2.5 mt-4">
                        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
                          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><List size={10} /> List</p>
                          <p className="text-sm font-black text-[var(--text-primary)] mt-1">₦{listTotal.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
                          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><ScaleIcon size={10} /> Scale</p>
                          <p className="text-sm font-black text-[var(--text-primary)] mt-1">₦{scaleTotal.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Total Audited Sales</p>
                      <p className="text-3xl font-black text-[var(--text-primary)]">₦{Number(report.totalSales).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="p-12 text-center text-slate-600 dark:text-slate-400 border border-dashed border-slate-800 dark:border-slate-200 rounded-2xl">
          No reports found.
        </div>
      )}
    </div>
  );
}
