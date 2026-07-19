"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Plus, Home, BarChart3, ReceiptText, User, Edit2, CheckCircle2, Search, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronUp, Flame } from "lucide-react";
import Link from "next/link";

interface InventoryItem {
  id: number | string;
  name: string;
  quantity: number;
  price: number;
  costPrice: number | null;
  category: string | null;
  restockLevel: number | null;
  image: string | null;
  salesCount?: number; // Added to handle Top Selling logic
}

type Tab = "all" | "low-stock" | "out-of-stock" | "top-selling";

export default function InventoryGrid({ items }: { items: InventoryItem[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [isTotalsOpen, setIsTotalsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const statusMessages: Record<string, string> = {
    added: "Item added successfully.",
    updated: "Changes saved successfully.",
    deleted: "Item deleted successfully.",
    archived: "Item had sales history, so it was marked Out of Stock instead of deleted.",
  };
  const [banner, setBanner] = useState<string | null>(status ? statusMessages[status] || null : null);

  useEffect(() => {
    if (!status) return;
    router.replace("/owner/inventory", { scroll: false });
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  // Derived filter categories
  const outOfStockItems = useMemo(() => items.filter((i) => i.quantity <= 0), [items]);
  
  const lowStockItems = useMemo(() => {
    return items.filter((i) => i.quantity > 0 && i.restockLevel != null && i.quantity <= i.restockLevel);
  }, [items]);

  const topSellingItems = useMemo(() => {
    // Sort items by salesCount descending (or fallback to items with higher margins/prices if salesCount doesn't exist)
    return [...items].sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
  }, [items]);

  const [searchQuery, setSearchQuery] = useState("");

  // Determine which list to render based on active tab
  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "low-stock":
        return lowStockItems;
      case "out-of-stock":
        return outOfStockItems;
      case "top-selling":
        return topSellingItems;
      case "all":
      default:
        return items;
    }
  }, [tab, items, lowStockItems, outOfStockItems, topSellingItems]);

  const visibleItems = searchQuery.trim()
    ? tabFiltered.filter((i) => i.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : tabFiltered;

  const { totalCost, totalSelling, totalProfit } = useMemo(() => {
    let cost = 0;
    let selling = 0;
    for (const item of items) {
      cost += (item.costPrice ?? 0) * item.quantity;
      selling += item.price * item.quantity;
    }
    return { totalCost: cost, totalSelling: selling, totalProfit: selling - cost };
  }, [items]);

  // Configuration for your new tab bar
  const tabs: { key: Tab; label: string; count?: number; icon?: React.ReactNode }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "low-stock", label: "Low Stock", count: lowStockItems.length },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockItems.length },
    { key: "top-selling", label: "Top Selling", icon: <Flame size={10} className="text-amber-500" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-24">
      {banner && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs font-medium px-4 py-2 flex items-center gap-2 sticky top-0 z-30">
          <CheckCircle2 size={14} />
          {banner}
        </div>
      )}
      
      {/* Slimmer Compact Header Block */}
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-2.5">
        
        {/* Back Button */}
        <Link 
          href="/owner/dashboard" 
          className="inline-flex items-center text-[10px] text-slate-500 hover:text-[var(--text-primary)] transition-colors mb-2"
        >
          ← Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Inventory</h1>
          <Link href="/owner/inventory/add" className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-semibold">
            <Plus size={12} /> Add Item
          </Link>
        </div>

        {/* Dropdown Totals Tab */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-lg mb-2 overflow-hidden transition-all">
          <button
            onClick={() => setIsTotalsOpen(!isTotalsOpen)}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Value Summary</span>
              {!isTotalsOpen && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-app)] ${totalProfit >= 0 ? "text-emerald-400 border border-emerald-500/10" : "text-rose-400 border border-rose-500/10"}`}>
                  Profit: ₦{totalProfit.toLocaleString()}
                </span>
              )}
            </div>
            {isTotalsOpen ? <ChevronUp size={14} className="text-slate-600 dark:text-slate-400" /> : <ChevronDown size={14} className="text-slate-600 dark:text-slate-400" />}
          </button>

          {isTotalsOpen && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/60 p-1 flex items-center justify-between bg-[var(--bg-surface)]">
              <div className="flex-1 text-center py-1 border-r border-slate-200/60 dark:border-slate-800/60">
                <p className="text-[8px] uppercase tracking-wide text-amber-400/70 font-semibold flex items-center justify-center gap-1 mb-0.5">
                  <Wallet size={8} /> Total Cost
                </p>
                <p className="text-[11px] font-bold text-amber-400 truncate px-1">₦{totalCost.toLocaleString()}</p>
              </div>
              <div className="flex-1 text-center py-1 border-r border-slate-200/60 dark:border-slate-800/60">
                <p className="text-[8px] uppercase tracking-wide text-blue-400/70 font-semibold flex items-center justify-center gap-1 mb-0.5">
                  <TrendingUp size={8} /> Total Selling
                </p>
                <p className="text-[11px] font-bold text-blue-400 truncate px-1">₦{totalSelling.toLocaleString()}</p>
              </div>
              <div className="flex-1 text-center py-1">
                <p className={`text-[8px] uppercase tracking-wide font-semibold flex items-center justify-center gap-1 mb-0.5 ${totalProfit >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                  {totalProfit >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />} Profit
                </p>
                <p className={`text-[11px] font-bold truncate px-1 ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  ₦{totalProfit.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Compact Search Input */}
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>

        {/* Tab Selection Row (Horizontal Scroll on Mobile) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--bg-surface)] text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="opacity-60 text-[10px]">({t.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 max-w-5xl mx-auto">
        {visibleItems.map((item) => {
          const isOutOfStock = item.quantity <= 0;
          const isLowStock = !isOutOfStock && item.restockLevel != null && item.quantity <= item.restockLevel;
          const margin = item.costPrice != null ? item.price - item.costPrice : null;

          return (
            <Link
              key={item.id}
              href={`/owner/inventory/${item.id}/edit`}
              className="bg-[var(--bg-surface)] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all flex flex-col relative group"
            >
              <div className="aspect-square bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300 dark:text-slate-700">
                    <Package size={40} />
                  </div>
                )}

                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                      Out of Stock
                    </span>
                  </div>
                )}

                {isLowStock && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                      Low Stock
                    </span>
                  </div>
                )}

                {item.category && (
                  <div className="absolute bottom-2 left-2 z-10">
                    <span className="bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
                      {item.category}
                    </span>
                  </div>
                )}

                {/* Hot badge for items rendered in Top Selling list */}
                {tab === "top-selling" && item.salesCount && item.salesCount > 0 && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-amber-500/90 text-slate-50 dark:text-slate-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                    <Flame size={10} fill="currentColor" /> {item.salesCount} sold
                  </div>
                )}

                <div className="absolute top-2 right-2 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Edit2 size={12} className="text-blue-400" />
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                <h2 className="font-semibold text-sm truncate text-[var(--text-primary)]">{item.name}</h2>

                <div className="flex justify-between items-center">
                  <p className={`text-xs ${isOutOfStock ? "text-rose-400 font-medium" : isLowStock ? "text-amber-400 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                    Qty: {item.quantity}
                  </p>
                  <p className="text-xs font-bold text-blue-400">Sell: ₦{item.price.toLocaleString()}</p>
                </div>

                {item.costPrice != null && (
                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                    <span className="font-semibold text-amber-400">Cost: ₦{item.costPrice.toLocaleString()}</span>
                    {margin != null && (
                      <span className={`font-semibold ${margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {margin >= 0 ? "+" : ""}₦{margin.toLocaleString()} margin
                      </span>
                    )}
                  </div>
                )}

                {item.restockLevel != null && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-600">Restock at: {item.restockLevel}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {visibleItems.length === 0 && (
        <div className="text-center mt-20 text-slate-500 px-6">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>
            {tab === "out-of-stock"
              ? "No out-of-stock items right now."
              : tab === "low-stock"
              ? "No low stock items right now."
              : tab === "top-selling"
              ? "No top-selling history found."
              : "No inventory items found. Add your first product to get started."}
          </p>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[var(--bg-app)]/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 pb-2 z-50 md:hidden">
        <Link href="/owner/dashboard" className="flex flex-col items-center gap-1 text-slate-500">
          <Home size={22} />
          <span className="text-[10px]">Home</span>
        </Link>
        <Link href="/owner/report" className="flex flex-col items-center gap-1 text-slate-500">
          <BarChart3 size={22} />
          <span className="text-[10px]">Stats</span>
        </Link>

        <Link href="/owner/inventory" className="flex flex-col items-center justify-center -mt-10">
          <div className="bg-blue-500 p-4 rounded-full shadow-lg shadow-blue-500/20 border-4 border-[var(--border-subtle)]">
            <Package size={28} className="text-[var(--text-primary)]" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-blue-400 mt-1">Inventory</span>
        </Link>

        <Link href="/owner/orders" className="flex flex-col items-center gap-1 text-slate-500">
          <ReceiptText size={22} />
          <span className="text-[10px]">Orders</span>
        </Link>
        <Link href="/owner/profile" className="flex flex-col items-center gap-1 text-slate-500">
          <User size={22} />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
      
      {/* Small custom style to hide scrollbar on horizontal scroll tabs */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}