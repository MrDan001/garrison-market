"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Scale as ScaleIcon, Clock, CheckCircle2, XCircle, TrendingDown, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { approveWastageAction, declineWastageAction } from "@/lib/scale-wastage.actions";
import { WASTAGE_REASON_LABELS } from "@/lib/wastage-constants";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

export default function OwnerWastageClient({ data }: { data: any }) {
  const { formatCurrency } = useBusinessCurrency();
  const router = useRouter();
  const { pending, monthly, monthTotal } = data;

  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const handleApprove = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await approveWastageAction(id);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: number) => {
    if (!declineReason.trim()) {
      setError("Please provide a reason for declining.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await declineWastageAction(id, declineReason);
      setDecliningId(null);
      setDeclineReason("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to decline.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePrint = (bucket: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wastage Report - ${bucket.month}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { font-size: 12px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .total { margin-top: 15px; font-weight: bold; font-size: 14px; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Wastage Report: ${bucket.month}</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Staff Name</th>
                <th>Reason</th>
                <th>Quantity</th>
                <th>Value Lost</th>
              </tr>
            </thead>
            <tbody>
              ${bucket.entries
                .map((entry: any) => {
                  const unitValue = entry.scaleInventory.costPrice != null ? Number(entry.scaleInventory.costPrice) : Number(entry.scaleInventory.price);
                  const entryValue = unitValue * Number(entry.quantityInBaseUnit);
                  return `
                <tr>
                  <td>${entry.scaleInventory.name}</td>
                  <td>${entry.staff?.fullName || "Staff"}</td>
                  <td>${WASTAGE_REASON_LABELS[entry.reason as keyof typeof WASTAGE_REASON_LABELS] ?? entry.reason}</td>
                  <td>${entry.quantity}${entry.unit}</td>
                  <td>${formatCurrency(entryValue)}</td>
                </tr>
              `;
                })
                .join("")}
            </tbody>
          </table>
          <div class="total">
            Total Value Lost: ${formatCurrency(bucket.value)}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-24">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
          <ScaleIcon size={18} className="text-rose-400" /> Wastage
        </h1>
      </div>

      <div className="p-4 space-y-5">
        {/* This month's total */}
        <div className="bg-gradient-to-br from-rose-600/10 to-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingDown size={12} /> Total Wastage This Month ({monthTotal.month})
          </p>
          <p className="text-2xl font-black text-[var(--text-primary)]">{formatCurrency(monthTotal.value)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Estimated value lost, based on current cost price</p>
        </div>

        {/* Pending approvals */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
            Pending Approval ({pending.length})
          </label>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs font-semibold text-rose-500">
              {error}
            </div>
          )}

          {pending.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">Nothing waiting for review.</p>
            </div>
          ) : (
            pending.map((entry: any) => (
              <div key={entry.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.scaleInventory.name}</p>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock size={10} /> Pending
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {entry.quantity}{entry.unit} · {WASTAGE_REASON_LABELS[entry.reason as keyof typeof WASTAGE_REASON_LABELS] ?? entry.reason} · logged by <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.staff?.fullName || "Staff"}</span>
                </p>
                {entry.note && <p className="text-xs text-slate-400 dark:text-slate-600 italic">"{entry.note}"</p>}

                {decliningId === entry.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Reason for declining (required, staff will see this)"
                      className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-[var(--text-primary)] outline-none focus:border-rose-600 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDecliningId(null); setDeclineReason(""); setError(null); }}
                        className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDecline(entry.id)}
                        disabled={busyId === entry.id}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white text-xs font-semibold"
                      >
                        {busyId === entry.id ? "Declining..." : "Confirm Decline"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setDecliningId(entry.id); setError(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={13} /> Decline
                    </button>
                    <button
                      onClick={() => handleApprove(entry.id)}
                      disabled={busyId === entry.id}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={13} /> {busyId === entry.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Monthly history */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">History by Month</label>
          {monthly.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 italic px-1">No approved wastage yet.</p>
          ) : (
            monthly.map((bucket: any) => (
              <div key={bucket.key} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenMonth(openMonth === bucket.key ? null : bucket.key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/50 hover:dark:bg-slate-900/50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{bucket.month}</p>
                    <p className="text-xs font-bold text-rose-500 dark:text-rose-400 mt-0.5">{formatCurrency(bucket.value)} lost</p>
                  </div>
                  {openMonth === bucket.key ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>
                {openMonth === bucket.key && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-3">
                    <div className="space-y-2">
                      {bucket.entries.map((entry: any) => {
                        const unitValue = entry.scaleInventory.costPrice != null ? Number(entry.scaleInventory.costPrice) : Number(entry.scaleInventory.price);
                        const entryValue = unitValue * Number(entry.quantityInBaseUnit);
                        return (
                          <div key={entry.id} className="flex justify-between items-start text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-900/50 pb-1.5 last:border-none">
                            <div>
                              <span className="font-semibold text-[var(--text-primary)]">{entry.scaleInventory.name}</span>
                              <span className="text-[11px] text-slate-400 block">Logged by <span className="text-slate-600 dark:text-slate-300">{entry.staff?.fullName || "Staff"}</span> · {WASTAGE_REASON_LABELS[entry.reason as keyof typeof WASTAGE_REASON_LABELS] ?? entry.reason}</span>
                            </div>
                            <div className="text-right whitespace-nowrap ml-2">
                              <span className="font-bold text-[var(--text-primary)] block">{entry.quantity}{entry.unit}</span>
                              <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{formatCurrency(entryValue)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handlePrint(bucket)}
                      className="w-full py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Printer size={13} /> Print {bucket.month} Report
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}