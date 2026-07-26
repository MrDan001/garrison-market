"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Scale as ScaleIcon, Clock, CheckCircle2, XCircle, Lock, TrendingDown, Package } from "lucide-react";
import { submitWastageAction } from "@/lib/scale-wastage.actions";
import { WASTAGE_REASON_LABELS, WASTAGE_REASONS } from "@/lib/wastage-constants";
import { unitsForBase } from "@/lib/scale-units";

interface ScaleItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

interface WastageEntry {
  id: number;
  quantity: number;
  unit: string;
  reason: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  declineReason: string | null;
  createdAt: string;
  scaleInventory: { name: string; unit: string };
}

interface WastageReport {
  month: string;
  totalQty: number;
  totalValue: number;
  count: number;
  byProduct: { name: string; unit: string; qty: number; value: number; count: number }[];
}

export default function StaffWastageClient({
  inventory,
  entries,
  canViewReport,
  report,
}: {
  inventory: ScaleItem[];
  entries: WastageEntry[];
  canViewReport: boolean;
  report: WastageReport | null;
}) {
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedItem = inventory.find((i) => i.id === Number(itemId));
  const pair = selectedItem ? unitsForBase(selectedItem.unit) : null;

  const handleItemChange = (id: string) => {
    setItemId(id);
    const inv = inventory.find((i) => i.id === Number(id));
    setUnit(inv?.unit || "");
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!itemId) return setError("Select an item.");
    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) return setError("Enter a valid amount.");
    if (!reason) return setError("Choose a reason.");

    setSubmitting(true);
    try {
      await submitWastageAction({
        scaleInventoryId: Number(itemId),
        quantity: qty,
        unit,
        reason,
        note: note.trim() || undefined,
      });
      setSuccess(true);
      setItemId("");
      setAmount("");
      setReason("");
      setNote("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to submit wastage entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved")
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={10} /> Approved
        </span>
      );
    if (status === "declined")
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle size={10} /> Declined
        </span>
      );
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock size={10} /> Pending
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-24">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
          <ScaleIcon size={18} className="text-rose-400" /> Log Wastage
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Submission form — always available regardless of the owner's
            report-visibility toggle. */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">New Entry</label>

          <select
            value={itemId}
            onChange={(e) => handleItemChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600"
          >
            <option value="">Select an item...</option>
            {inventory.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.quantity}{inv.unit} in stock)
              </option>
            ))}
          </select>

          {selectedItem && (
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600"
              />
              {pair && (
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                  {[pair.base, pair.sub].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-3 text-xs font-bold transition-colors ${
                        unit === u ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600"
          >
            <option value="">Select a reason...</option>
            {WASTAGE_REASONS.map((r) => (
              <option key={r} value={r}>
                {WASTAGE_REASON_LABELS[r]}
              </option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600 resize-none"
          />

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs font-semibold text-rose-500">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs font-semibold text-emerald-500">
              Submitted — waiting for your owner's approval.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white font-bold text-sm transition-all active:scale-[0.98]"
          >
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>

        {/* Own submissions — always visible so staff can see approval
            status, independent of the report-visibility toggle. */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Your Recent Entries</label>
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 italic px-1">No wastage entries yet.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{entry.scaleInventory.name}</p>
                  {statusBadge(entry.status)}
                </div>
                <p className="text-xs text-slate-500">
                  {entry.quantity}{entry.unit} · {WASTAGE_REASON_LABELS[entry.reason as keyof typeof WASTAGE_REASON_LABELS] ?? entry.reason}
                </p>
                {entry.status === "declined" && entry.declineReason && (
                  <p className="text-xs text-rose-400 mt-1">Declined: {entry.declineReason}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Report view — gated by the owner's toggle. Same monthly
            total/per-product breakdown the owner sees, store-wide. */}
        {!canViewReport ? (
          <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
            <Lock size={22} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500">Your owner hasn't turned on wastage report access for staff yet.</p>
          </div>
        ) : report ? (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-rose-950/40 to-[var(--bg-surface)] border border-rose-500/20 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <TrendingDown size={12} /> Total Wastage This Month ({report.month})
              </p>
              <p className="text-2xl font-black text-[var(--text-primary)]">
                ₦{report.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">{report.count} entr{report.count === 1 ? "y" : "ies"} logged</p>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">By Product</label>
              {report.byProduct.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-600 italic px-1">No approved wastage yet this month.</p>
              ) : (
                report.byProduct.map((p) => (
                  <div key={p.name} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
                        <Package size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.qty}{p.unit} · {p.count} entr{p.count === 1 ? "y" : "ies"}</p>
                      </div>
                    </div>
                    <span className="font-bold text-[var(--text-primary)] text-sm shrink-0">
                      ₦{p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}