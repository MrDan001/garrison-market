"use client";

import { useState } from "react";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Archive, ShoppingCart, TrendingDown, Package2, Users, Clock,
  ShoppingBag, PlusCircle, Hash, Tag, Calendar, ArrowLeftRight, AlertTriangle,
  PackageMinus, Zap, MinusCircle,
} from "lucide-react";
import RecordLossModal from "@/components/RecordLossModal";
import RecordReturnModal from "@/components/RecordReturnModal";

interface SalesHistoryLine {
  id: number;
  orderId: number;
  buyerName: string;
  quantity: number;
  amount: number;
  date: string;
  paymentMethod: string;
  staffName: string | null;
}

interface CustomerLine {
  name: string;
  orderCount: number;
  quantity: number;
  spent: number;
}

interface LossLine {
  id: number;
  quantity: number;
  reason: string;
  note: string | null;
  date: string;
  recordedByName: string | null;
}

interface ReturnLine {
  id: number;
  quantity: number;
  supplierName: string | null;
  reason: string | null;
  refundAmount: number | null;
  note: string | null;
  date: string;
  recordedByName: string | null;
}

interface ActivityLine {
  type: "created" | "sold" | "loss" | "return";
  staffName: string | null;
  buyerName?: string;
  orderId?: number;
  quantity: number;
  date: string;
  paymentMethod: string | null;
  detail?: string | null;
}

interface BatchDetail {
  id: number;
  inventoryId: number;
  inventoryName: string;
  inventoryImage: string | null;
  addedAt: string;
  originalQty: number;
  remainingQty: number;
  consumedQty: number;
  percentUsed: number;
  costPrice: number | null;
  sellingPriceAtTime: number;
  expiryDate: string | null;
  paymentMethod: string | null;
  isActive: boolean;
  createdByName: string | null;
  salesOverview: {
    costSpent: number;
    expectedRevenue: number;
    actualRevenue: number;
    discountGiven: number;
    ordersCount: number;
    quantitySold: number;
  };
  salesHistory: SalesHistoryLine[];
  customers: CustomerLine[];
  losses: LossLine[];
  returns: ReturnLine[];
  activity: ActivityLine[];
}

type SubTab = "details" | "sales" | "customers" | "loss" | "returns" | "activity";

const naira = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function BatchDetailClient({ data, productId }: { data: BatchDetail; productId: string }) {
  const { formatCurrency } = useBusinessCurrency();
  const router = useRouter();
  const [tab, setTab] = useState<SubTab>("details");
  const [showLossModal, setShowLossModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const subTabs: { key: SubTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: "details", label: "Details", icon: <Archive size={12} /> },
    { key: "sales", label: "Sales", count: data.salesOverview.ordersCount, icon: <ShoppingCart size={12} /> },
    { key: "customers", label: "Customers", count: data.customers.length, icon: <Users size={12} /> },
    { key: "loss", label: "Loss", count: data.losses.length, icon: <AlertTriangle size={12} /> },
    { key: "returns", label: "Returns", count: data.returns.length, icon: <PackageMinus size={12} /> },
    { key: "activity", label: "Activity", icon: <Clock size={12} /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push(`/owner/inventory/${productId}`)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold flex-1">Batch Details</h1>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
              data.isActive
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-slate-500/10 text-slate-500 border-slate-500/30"
            }`}
          >
            {data.isActive ? "Active" : "Depleted"}
          </span>
        </div>

        {/* Item + batch date */}
        <div className="flex items-center gap-3 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
            <Archive size={20} />
          </div>
          <div>
            <p className="text-sm font-bold">{data.inventoryName}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar size={11} /> {fmtDate(data.addedAt)}
            </p>
          </div>
        </div>

        {/* Stock Usage */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-4 mb-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold flex items-center gap-1.5">
              <Package2 size={15} /> Stock Usage
            </span>
            <span className="text-sm font-bold">{data.percentUsed}% used</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden mb-3">
            <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, data.percentUsed)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 bg-white/10 rounded-xl p-3">
            <div className="text-center">
              <p className="text-lg font-bold">{data.originalQty}</p>
              <p className="text-[10px] opacity-80">Original</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{data.consumedQty}</p>
              <p className="text-[10px] opacity-80">Consumed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{data.remainingQty}</p>
              <p className="text-[10px] opacity-80">Remaining</p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 mb-4">
          {subTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && <span className="opacity-60 text-[10px]">({t.count})</span>}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <div className="space-y-4">
            <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
              <Row icon={<Calendar size={13} />} label="Added On" value={fmtDate(data.addedAt)} />
              <Row icon={<Hash size={13} />} label="Batch ID" value={`#${data.id}`} />
              <Row icon={<Tag size={13} />} label="Selling Price" value={`${formatCurrency(data.sellingPriceAtTime)} / unit`} valueClassName="text-emerald-500" />
              {data.costPrice != null && (
                <Row icon={<Tag size={13} />} label="Cost Price" value={`${formatCurrency(data.costPrice)} / unit`} />
              )}
              {data.paymentMethod && <Row icon={<ArrowLeftRight size={13} />} label="Paid By" value={data.paymentMethod} />}
              {data.createdByName && <Row icon={<Users size={13} />} label="Added By" value={data.createdByName} />}
              {data.expiryDate && <Row icon={<Clock size={13} />} label="Expiry Date" value={fmtDate(data.expiryDate)} />}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Zap size={12} /> Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowLossModal(true)}
                  disabled={data.remainingQty <= 0}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/30 font-semibold text-sm disabled:opacity-40 transition-colors"
                >
                  <AlertTriangle size={14} /> Record Loss
                </button>
                <button
                  onClick={() => setShowReturnModal(true)}
                  disabled={data.remainingQty <= 0}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/30 font-semibold text-sm disabled:opacity-40 transition-colors"
                >
                  <PackageMinus size={14} /> Return
                </button>
              </div>
              {data.remainingQty <= 0 && (
                <p className="text-[11px] text-slate-500 mt-2">This batch is fully depleted — nothing left to record loss or returns against.</p>
              )}
            </div>
          </div>
        )}

        {tab === "loss" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recorded Losses</p>
              {data.losses.length > 0 && (
                <span className="text-[11px] font-semibold text-orange-500">
                  {data.losses.reduce((sum, l) => sum + l.quantity, 0)} units total
                </span>
              )}
            </div>
            {data.losses.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No losses recorded for this batch.</p>
            ) : (
              <div className="space-y-2">
                {data.losses.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                      <MinusCircle size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {l.quantity} unit{l.quantity !== 1 ? "s" : ""} · {l.reason}
                      </p>
                      {l.note && <p className="text-[11px] text-slate-500 mt-0.5">{l.note}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmtDateTime(l.date)}{l.recordedByName ? ` · ${l.recordedByName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "returns" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Supplier Returns</p>
              {data.returns.length > 0 && (
                <span className="text-[11px] font-semibold text-blue-500">
                  {data.returns.reduce((sum, r) => sum + r.quantity, 0)} units total
                </span>
              )}
            </div>
            {data.returns.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No returns recorded for this batch.</p>
            ) : (
              <div className="space-y-2">
                {data.returns.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                      <PackageMinus size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {r.quantity} unit{r.quantity !== 1 ? "s" : ""}{r.supplierName ? ` → ${r.supplierName}` : ""}
                      </p>
                      {r.reason && <p className="text-[11px] text-slate-500 mt-0.5">{r.reason}</p>}
                      {r.refundAmount != null && (
                        <p className="text-[11px] text-emerald-500 mt-0.5 font-semibold">Refunded {formatCurrency(r.refundAmount)}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmtDateTime(r.date)}{r.recordedByName ? ` · ${r.recordedByName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Batch Report Overview</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Metric icon={<ShoppingBag size={14} />} label="Cost Spent" value={formatCurrency(data.salesOverview.costSpent)} className="text-orange-500" />
                <Metric icon={<Tag size={14} />} label="Expected Revenue" value={formatCurrency(data.salesOverview.expectedRevenue)} className="text-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={<TrendingDown size={14} />} label="Discount Given" value={formatCurrency(data.salesOverview.discountGiven)} className="text-purple-500" />
                <Metric icon={<Tag size={14} />} label="Actual Revenue" value={formatCurrency(data.salesOverview.actualRevenue)} className="text-emerald-500" />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Sales History {data.salesHistory.length > 0 && `(${data.salesHistory.length})`}
              </p>
              {data.salesHistory.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No sales from this batch yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.salesHistory.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-semibold">{s.buyerName}</p>
                        <p className="text-[11px] text-slate-500">
                          {s.quantity} unit{s.quantity !== 1 ? "s" : ""} · {fmtDateTime(s.date)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-emerald-500">{formatCurrency(s.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "customers" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Customers</p>
              <span className="text-[11px] font-semibold text-slate-500">{data.customers.length} buyer{data.customers.length !== 1 ? "s" : ""}</span>
            </div>
            {data.customers.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No buyers for this batch yet.</p>
            ) : (
              <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
                {data.customers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500">
                        <Users size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.orderCount} order{c.orderCount !== 1 ? "s" : ""} · {c.quantity} unit{c.quantity !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-blue-500">{formatCurrency(c.spent)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Activity Log</p>
            {data.activity.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {data.activity.map((a, i) => {
                  const style = ACTIVITY_STYLE[a.type];
                  return (
                    <div key={i} className="flex items-start gap-3 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mr-1.5 ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          <span className="font-semibold">{a.staffName || "Unknown"}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {a.type === "created" && `0 → ${a.quantity}${a.paymentMethod ? ` · ${a.paymentMethod}` : ""}`}
                          {a.type === "sold" && `${a.buyerName}${a.orderId ? ` · #${a.orderId}` : ""} · ${a.quantity} unit${a.quantity !== 1 ? "s" : ""}`}
                          {(a.type === "loss" || a.type === "return") &&
                            `${a.quantity} unit${a.quantity !== 1 ? "s" : ""}${a.detail ? ` · ${a.detail}` : ""}`}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(a.date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showLossModal && (
        <RecordLossModal batchId={data.id} remainingQty={data.remainingQty} onClose={() => setShowLossModal(false)} />
      )}
      {showReturnModal && (
        <RecordReturnModal batchId={data.id} remainingQty={data.remainingQty} onClose={() => setShowReturnModal(false)} />
      )}
    </div>
  );
}

const ACTIVITY_STYLE: Record<
  ActivityLine["type"],
  { bg: string; text: string; icon: React.ReactNode; label: string }
> = {
  created: { bg: "bg-emerald-500/10", text: "text-emerald-500", icon: <PlusCircle size={15} />, label: "Created" },
  sold: { bg: "bg-blue-500/10", text: "text-blue-500", icon: <ShoppingCart size={15} />, label: "Sold" },
  loss: { bg: "bg-orange-500/10", text: "text-orange-500", icon: <MinusCircle size={15} />, label: "Loss" },
  return: { bg: "bg-purple-500/10", text: "text-purple-500", icon: <PackageMinus size={15} />, label: "Return" },
};

function Row({ icon, label, value, valueClassName = "" }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-500 flex items-center gap-2">
        {icon} {label}
      </span>
      <span className={`text-sm font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}

function Metric({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3">
      <div className={`flex items-center gap-1.5 mb-1 ${className}`}>{icon}</div>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}