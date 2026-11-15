"use client";

import { useState } from "react";
import { Search, Minus, Plus, Trash2 } from "lucide-react";
import { updateInventoryQuantity } from "@/lib/business.actions";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  price: number | string;
};

export default function InventorySearch({ items }: { items: InventoryItem[] }) {
  const { formatCurrency, currencyCode } = useBusinessCurrency();
  const [query, setQuery] = useState("");

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[var(--text-primary)] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          No items match "{query}"
        </div>
      ) : (
        <div className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-left hidden sm:table">
            <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Item Name</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((item: InventoryItem) => (
                <tr key={item.id} className="hover:bg-slate-200/20 hover:dark:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">{item.name}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <form action={updateInventoryQuantity.bind(null, item.id, -1)}>
                        <button type="submit" className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                          <Minus size={14} />
                        </button>
                      </form>
                      <span className="w-8 text-center font-mono text-sm font-bold text-[var(--text-primary)]">
                        {item.quantity}
                      </span>
                      <form action={updateInventoryQuantity.bind(null, item.id, 1)}>
                        <button type="submit" className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                          <Plus size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300 font-medium">
                    {formatCurrency(Number(item.price))}
                  </td>
                  <td className="px-5 py-4">
                    <button className="h-7 w-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 hover:text-rose-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-slate-800/60">
            {filtered.map((item: InventoryItem) => (
              <div key={item.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ₦{Number(item.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={updateInventoryQuantity.bind(null, item.id, -1)}>
                    <button type="submit" className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                      <Minus size={14} />
                    </button>
                  </form>
                  <span className="w-7 text-center font-mono text-sm font-bold text-[var(--text-primary)]">
                    {item.quantity}
                  </span>
                  <form action={updateInventoryQuantity.bind(null, item.id, 1)}>
                    <button type="submit" className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                      <Plus size={14} />
                    </button>
                  </form>
                  <button className="h-8 w-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 transition-colors ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-600 text-right">
        {filtered.length} of {items.length} items
      </p>
    </div>
  );
}