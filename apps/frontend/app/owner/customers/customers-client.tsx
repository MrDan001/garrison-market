"use client";
// FILE: apps/frontend/app/owner/customers/customers-client.tsx
//
// Ranked customer table for the active store. All numbers come straight
// from getCustomersForOwner — nothing here is cached or derived client-side,
// so switching year/month always reflects a fresh read of the Order table.

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Trophy, Phone, Receipt } from "lucide-react";
import { getCustomersForOwner } from "@/lib/customer.actions";

type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
};

type CustomersData = {
  customers: CustomerRow[];
  years: number[];
  year: number;
  month: number | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function CustomersClient({ initial }: { initial: CustomersData }) {
  const [data, setData] = useState<CustomersData>(initial);
  const [isPending, startTransition] = useTransition();

  function refetch(year: number, month: number | null) {
    startTransition(async () => {
      const result = await getCustomersForOwner({ year, month });
      setData(result);
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back Dashboard
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6 lg:mb-8 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Users className="text-blue-500" /> Customers
          </h1>

          <div className="flex items-center gap-2">
            <select
              value={data.month ?? ""}
              onChange={(e) => {
                const month = e.target.value ? parseInt(e.target.value, 10) : null;
                refetch(data.year, month);
              }}
              className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            >
              <option value="">Whole Year</option>
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>

            <select
              value={data.year}
              onChange={(e) => refetch(parseInt(e.target.value, 10), data.month)}
              className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            >
              {data.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {data.customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
            <Users className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
            No customers recorded yet {data.month ? `for ${MONTHS[data.month - 1]} ${data.year}` : `in ${data.year}`}.
            <p className="text-xs mt-2 text-slate-500/80 max-w-xs mx-auto">
              Customers show up here once staff pick or type a name and phone number at checkout.
            </p>
          </div>
        ) : (
          <div className={`bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-opacity ${isPending ? "opacity-50" : ""}`}>
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] uppercase tracking-wider font-bold text-slate-500">
              <span>#</span>
              <span>Customer</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Total Spent</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {data.customers.map((c, idx) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3.5 items-center"
                >
                  <span className="flex items-center justify-center">
                    {idx === 0 ? (
                      <Trophy size={16} className="text-amber-400" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400 w-4 text-center">{idx + 1}</span>
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {c.phone}
                    </p>
                  </div>

                  <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 justify-end">
                    <Receipt size={12} /> {c.orderCount}
                  </span>

                  <span className="text-sm font-bold text-emerald-500 text-right">
                    {NAIRA.format(c.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}