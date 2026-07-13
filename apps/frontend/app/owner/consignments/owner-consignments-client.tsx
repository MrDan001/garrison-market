"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Calendar, User } from "lucide-react";

export default function OwnerConsignmentsClient({ consignments }: { consignments: any[] }) {
  const [filter, setFilter] = useState<"all" | "out" | "settled">("all");

  const filtered = consignments.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="min-h-screen bg-[#0A0C12] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#11131A] border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/owner/dashboard" className="h-8 w-8 rounded-lg bg-[#161a29] hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-white flex items-center gap-2">
          <Truck size={17} className="text-blue-400" /> Consignments
        </h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="flex gap-2">
          {(["all", "out", "settled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "out" ? "Outstanding" : "Settled"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#11131A] border border-dashed border-slate-800 rounded-2xl p-12 text-center">
            <Truck size={32} className="mx-auto mb-3 text-slate-700" />
            <p className="text-sm text-slate-500">No consignments found.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const totalOut = c.items.reduce((sum: number, i: any) => sum + i.quantityOut, 0);
            const totalSold = c.items.reduce((sum: number, i: any) => sum + i.quantitySold, 0);
            const totalReturned = c.items.reduce((sum: number, i: any) => sum + i.quantityReturned, 0);
            const totalValue = c.items.reduce(
              (sum: number, i: any) => sum + Number(i.priceAtTime) * i.quantitySold,
              0
            );

            return (
              <div key={c.id} className="bg-[#11131A] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.recipientName}</p>
                    <p className="text-xs text-slate-500">{c.recipientPhone}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <User size={11} /> Signed out by {c.staff?.fullName || "Staff"}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={11} /> {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      c.status === "out"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {c.status === "out" ? "Outstanding" : "Settled"}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1.5">
                  {c.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-400">
                      <span>{item.inventory?.name}</span>
                      <span>
                        {item.quantityOut} out
                        {c.status === "settled" && ` · ${item.quantitySold} sold · ${item.quantityReturned} returned`}
                      </span>
                    </div>
                  ))}
                </div>

                {c.status === "settled" && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-500">Revenue from consignment</span>
                    <span className="text-sm font-bold text-emerald-400">₦{totalValue.toLocaleString()}</span>
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