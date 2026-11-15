"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, X, ChevronRight, ShoppingBag, TrendingDown, Users,
  Receipt, PieChart as PieChartIcon,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getScaleProductReport } from "@/lib/product-report.actions";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

type RangeKey =
  | "today" | "yesterday" | "thisWeek" | "lastWeek"
  | "thisMonth" | "lastMonth" | "thisQuarter" | "lastQuarter" | "custom";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  lastWeek: "Last Week",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  thisQuarter: "This Quarter",
  lastQuarter: "Last Quarter",
  custom: "Custom Range",
};

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeRange(key: RangeKey, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case "today":
      return { start: toISODate(today), end: toISODate(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: toISODate(y), end: toISODate(y) };
    }
    case "thisWeek": {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      return { start: toISODate(start), end: toISODate(today) };
    }
    case "lastWeek": {
      const end = new Date(today);
      end.setDate(end.getDate() - end.getDay() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start: toISODate(start), end: toISODate(end) };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISODate(start), end: toISODate(today) };
    }
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: toISODate(start), end: toISODate(end) };
    }
    case "thisQuarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      return { start: toISODate(start), end: toISODate(today) };
    }
    case "lastQuarter": {
      const q = Math.floor(today.getMonth() / 3) - 1;
      const year = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const qNorm = ((q % 4) + 4) % 4;
      const start = new Date(year, qNorm * 3, 1);
      const end = new Date(year, qNorm * 3 + 3, 0);
      return { start: toISODate(start), end: toISODate(end) };
    }
    case "custom":
      return { start: customStart || toISODate(today), end: customEnd || toISODate(today) };
  }
}

interface ScaleReportData {
  itemName: string;
  unit: string;
  range: { start: string; end: string };
  summary: {
    revenue: number;
    profit: number;
    qtySold: number;
    orders: number;
    customers: number;
    margin: number;
    totalDiscounts: number;
  };
  dailySeries: { date: string; qty: number; revenue: number; profit: number }[];
  dayOfWeekSeries: { day: string; revenue: number }[];
}

export default function ScaleProductReportTab({ itemId }: { itemId: number }) {
  const { formatCurrency } = useBusinessCurrency();
  const formatCompactCurrency = (n: number) => Math.abs(n) >= 1000 ? `${formatCurrency(n / 1000)}k` : formatCurrency(n);
  const [rangeKey, setRangeKey] = useState<RangeKey>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [report, setReport] = useState<ScaleReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (key: RangeKey, cs?: string, ce?: string) => {
    setLoading(true);
    const { start, end } = computeRange(key, cs, ce);
    const data = await getScaleProductReport(itemId, start, end);
    setReport(data as ScaleReportData | null);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchReport(rangeKey, customStart, customEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const selectRange = (key: RangeKey) => {
    setRangeKey(key);
    setShowPicker(false);
    if (key !== "custom") fetchReport(key);
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    setRangeKey("custom");
    setShowPicker(false);
    fetchReport("custom", customStart, customEnd);
  };

  return (
    <div className="space-y-4">
      {/* Date range trigger row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => selectRange("today")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            rangeKey === "today"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
          }`}
        >
          Today
        </button>
        <button
          onClick={() => selectRange("thisMonth")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            rangeKey === "thisMonth"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
          }`}
        >
          This Month
        </button>
        {rangeKey !== "today" && rangeKey !== "thisMonth" && (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
            {rangeKey === "custom" ? `${report?.range.start ?? ""} → ${report?.range.end ?? ""}` : RANGE_LABELS[rangeKey]}
          </span>
        )}
        <button
          onClick={() => setShowPicker(true)}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800/85 flex items-center justify-center text-slate-500 shrink-0"
        >
          <Calendar size={14} />
        </button>
      </div>

      {loading || !report ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading report…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Revenue" value={formatCurrency(report.summary.revenue)} valueClassName="text-emerald-500" />
            <SummaryCard label="Profit" value={formatCurrency(report.summary.profit)} valueClassName="text-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard icon={<ShoppingBag size={14} />} label="Qty Sold" value={`${report.summary.qtySold}${report.unit}`} />
            <SummaryCard icon={<Receipt size={14} />} label="Orders" value={String(report.summary.orders)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard icon={<Users size={14} />} label="Customers" value={String(report.summary.customers)} />
            <SummaryCard icon={<PieChartIcon size={14} />} label="Margin" value={`${report.summary.margin}%`} valueClassName="text-emerald-500" />
          </div>
          <SummaryCard icon={<TrendingDown size={14} />} label="Total Discounts" value={formatCurrency(report.summary.totalDiscounts)} full />

          {/* Revenue Analytics */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Revenue Analytics</p>
            <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => new Date(d).getDate().toString()} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={40} />
                    <Tooltip
                      formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), name === "revenue" ? "Revenue" : "Profit"]}
                      labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      contentStyle={{ background: "var(--bg-app)", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <Legend color="#3b82f6" label="Revenue" />
                <Legend color="#a855f7" label="Profit" />
              </div>
            </div>
          </div>

          {/* Profit Trend */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Profit Trend</p>
            <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => new Date(d).getDate().toString()} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={40} />
                    <Tooltip
                      formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), name === "profit" ? "Profit" : "Revenue"]}
                      labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                      contentStyle={{ background: "var(--bg-app)", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="profit" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <Legend color="#a855f7" label="Profit" />
                <Legend color="#c4b5fd" label="Revenue" />
              </div>
            </div>
          </div>

          {/* Sales by Day of Week */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Sales by Day of Week</p>
            <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dayOfWeekSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={40} />
                    <Tooltip
                      formatter={(v: any) => [formatCurrency(Number(v) || 0), "Revenue"]}
                      contentStyle={{ background: "var(--bg-app)", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Date Range picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[var(--bg-app)] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 pb-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1 text-center">
                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 mx-auto mb-2">
                  <Calendar size={18} />
                </div>
                <h2 className="text-base font-bold">Date Range</h2>
                <p className="text-xs text-slate-500">Filter data by time period</p>
              </div>
              <button onClick={() => setShowPicker(false)} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Quick Select</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(RANGE_LABELS) as RangeKey[])
                .filter((k) => k !== "custom")
                .map((k) => (
                  <button
                    key={k}
                    onClick={() => selectRange(k)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      rangeKey === k
                        ? "bg-blue-600/10 text-blue-500 border border-blue-500"
                        : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${rangeKey === k ? "bg-blue-500" : "bg-slate-400"}`} />
                    {RANGE_LABELS[k]}
                  </button>
                ))}
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Custom</p>
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                />
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                />
              </div>
              <button
                onClick={applyCustomRange}
                disabled={!customStart || !customEnd}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Apply Custom Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "",
  full = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  full?: boolean;
}) {
  return (
    <div className={`bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl p-3 ${full ? "col-span-2" : ""}`}>
      {icon && <div className="text-slate-500 mb-1">{icon}</div>}
      <p className={`text-lg font-bold ${valueClassName}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}