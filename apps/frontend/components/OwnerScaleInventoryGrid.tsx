// FILE: apps/frontend/components/OwnerScaleInventoryGrid.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Plus, CheckCircle2, Search, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronUp, Flame, Hash, Clock, Tag } from "lucide-react";
import Link from "next/link";
import { getExpiryStatus } from "@/lib/expiry-status";

interface ScaleInventoryItem {
  id: number | string;
  name: string;
  quantity: number; // in base unit (kg or L)
  unit: string;
  price: number;
  costPrice: number | null;
  category: string | null; // legacy string — used only if categoryName isn't set
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  trackExpiry?: boolean;
  expiryDate?: string | null;
  restockLevel: number | null;
  image: string | null;
  salesCount?: number;
}

interface ProductCategoryOption {
  id: number;
  name: string;
  itemCount: number;
}

type Tab = "all" | "low-stock" | "out-of-stock" | "expiring" | "top-selling";

// Stage 2 follow-up: the Scale tab now looks and behaves exactly like the
// List tab (InventoryGrid) — same card grid, same image handling, same
// cost/margin display, same Add Item / edit-by-tapping-the-card pattern —
// just reading from ScaleInventory instead of Inventory, and labelling
// quantities in the product's kg/L unit instead of a bare count. Add and
// edit both navigate to the existing full-page forms (AddScaleInventoryForm
// / ScaleInventoryEditForm) via ?type=scale, the same forms native scale
// stores already use.
export default function OwnerScaleInventoryGrid({ items, categories = [] }: { items: ScaleInventoryItem[]; categories?: ProductCategoryOption[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
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
    router.replace("/owner/inventory?tab=scale", { scroll: false });
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const outOfStockItems = useMemo(() => items.filter((i) => i.quantity <= 0), [items]);

  const lowStockItems = useMemo(() => {
    return items.filter((i) => i.quantity > 0 && i.restockLevel != null && i.quantity <= i.restockLevel);
  }, [items]);

  const topSellingItems = useMemo(() => {
    return [...items].sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
  }, [items]);

  const expiringItems = useMemo(() => {
    return items.filter((i) => getExpiryStatus(i.trackExpiry, i.expiryDate) !== null);
  }, [items]);

  const [searchQuery, setSearchQuery] = useState("");

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "low-stock":
        return lowStockItems;
      case "out-of-stock":
        return outOfStockItems;
      case "expiring":
        return expiringItems;
      case "top-selling":
        return topSellingItems.filter((i) => (i.salesCount ?? 0) > 0);
      default:
        return items;
    }
  }, [tab, items, lowStockItems, outOfStockItems, expiringItems, topSellingItems]);

  const visibleItems = useMemo(() => {
    const byCategory = categoryId === "all" ? tabFiltered : tabFiltered.filter((i) => i.categoryId === categoryId);
    if (!searchQuery.trim()) return byCategory;
    const q = searchQuery.toLowerCase();
    return byCategory.filter((i) => i.name.toLowerCase().includes(q));
  }, [tabFiltered, categoryId, searchQuery]);

  const selectedCategoryName = categoryId === "all" ? null : categories.find((c) => c.id === categoryId)?.name ?? null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "all", label: "All", icon: null, count: items.length },
    { key: "low-stock", label: "Low Stock", icon: null, count: lowStockItems.length },
    { key: "out-of-stock", label: "Out of Stock", icon: null, count: outOfStockItems.length },
    { key: "expiring", label: "Expiring Soon", icon: <Clock size={11} className="text-orange-500" />, count: expiringItems.length },
    { key: "top-selling", label: "Top Selling", icon: <Flame size={11} /> },
  ];

  const totalCost = useMemo(() => items.reduce((sum, i) => sum + (i.costPrice ?? 0) * i.quantity, 0), [items]);
  const totalSelling = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const totalProfit = totalSelling - totalCost;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-24">
      {banner && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs font-medium px-4 py-2 flex items-center gap-2 sticky top-0 z-30">
          <CheckCircle2 size={14} />
          {banner}
        </div>
      )}

      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Scale Inventory</h1>
          <Link
            href="/owner/inventory/add?type=scale"
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-semibold text-white"
          >
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
            placeholder="Search scale products..."
            className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>

        {/* Category Filter Dropdown — populated from owner-created categories */}
        {categories.length > 0 && (
          <div className="relative mb-2">
            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
            <select
              value={categoryId === "all" ? "all" : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full appearance-none bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-600 transition-colors"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.itemCount})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        )}

        {/* Tab Selection Row */}
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
              {t.count !== undefined && <span className="opacity-60 text-[10px]">({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 max-w-5xl mx-auto">
        {visibleItems.map((item) => {
          const isOutOfStock = item.quantity <= 0;
          const isLowStock = !isOutOfStock && item.restockLevel != null && item.quantity <= item.restockLevel;
          const margin = item.costPrice != null ? item.price - item.costPrice : null;
          const displayCategory = item.categoryName ?? item.category;
          const expiryStatus = getExpiryStatus(item.trackExpiry, item.expiryDate);

          return (
            <Link
              key={item.id}
              href={`/owner/inventory/${item.id}?type=scale`}
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

                {(isLowStock || expiryStatus) && (
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
                    {isLowStock && (
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                        Low Stock
                      </span>
                    )}
                    {expiryStatus && (
                      <span
                        className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                          expiryStatus === "expired"
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        }`}
                      >
                        <Clock size={9} />
                        {expiryStatus === "expired" ? "Expired" : "Expiring Soon"}
                      </span>
                    )}
                  </div>
                )}

                {displayCategory && (
                  <div className="absolute bottom-2 left-2 z-10">
                    <span className="bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
                      {displayCategory}
                    </span>
                  </div>
                )}

                {tab === "top-selling" && item.salesCount && item.salesCount > 0 && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-amber-500/90 text-slate-50 dark:text-slate-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                    <Flame size={10} fill="currentColor" /> {item.salesCount}{item.unit} sold
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                <h2 className="font-semibold text-sm truncate text-[var(--text-primary)]">{item.name}</h2>

                <div className="flex justify-between items-center">
                  <p className={`text-xs ${isOutOfStock ? "text-rose-400 font-medium" : isLowStock ? "text-amber-400 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                    Qty: {item.quantity}{item.unit}
                  </p>
                  <p className="text-xs font-bold text-blue-400">Sell: ₦{item.price.toLocaleString()}/{item.unit}</p>
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

                {(item.restockLevel != null || item.sku) && (
                  <div className="flex items-center justify-between gap-1">
                    {item.restockLevel != null && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-600">Restock at: {item.restockLevel}{item.unit}</p>
                    )}
                    {item.sku && (
                      <p className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-600 truncate">
                        <Hash size={9} />
                        {item.sku}
                      </p>
                    )}
                  </div>
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
              : tab === "expiring"
              ? "No items expiring soon."
              : tab === "top-selling"
              ? "No top-selling history found."
              : "No scale products yet. Add your first one to get started."}
            {selectedCategoryName && ` (Category: ${selectedCategoryName})`}
          </p>
        </div>
      )}

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