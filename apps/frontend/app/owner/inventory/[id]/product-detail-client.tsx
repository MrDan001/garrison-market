"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Pencil, Trash2, Package, Clock, Hash, ChevronRight,
  Archive, CheckCircle2, BarChart3,
} from "lucide-react";
import { deleteInventoryAction } from "@/lib/business.actions";
import ProductReportTab from "@/components/ProductReportTab";

interface ProductItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  costPrice: number | null;
  categoryName: string | null;
  sku: string | null;
  description: string | null;
  image: string | null;
  image2: string | null;
  image3: string | null;
  trackExpiry: boolean;
  expiryDate: string | null;
  restockLevel: number | null;
  margin: number | null;
}

interface BatchSummary {
  id: number;
  addedAt: string;
  originalQty: number;
  remainingQty: number;
  isActive: boolean;
}

type Tab = "batches" | "details" | "report";

export default function ProductDetailClient({ item, batches }: { item: ProductItem; batches: BatchSummary[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("batches");
  const [isDeleting, setIsDeleting] = useState(false);

  const isOutOfStock = item.quantity <= 0;

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? If it has sales history, it'll be marked Out of Stock instead of being removed, so past orders stay intact.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("id", String(item.id));
      const result = await deleteInventoryAction(formData);
      const statusParam = result?.archived ? "archived" : "deleted";
      router.push(`/owner/inventory?status=${statusParam}`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
      alert(err?.message || "Failed to delete item. Please try again.");
    }
  };

  const images = [item.image, item.image2, item.image3].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push("/owner/inventory")}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1" />
          <Link
            href={`/owner/inventory/${item.id}/add-stock`}
            className="flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-semibold text-white transition-colors"
          >
            <Plus size={14} /> Add Stock
          </Link>
          <Link
            href={`/owner/inventory/${item.id}/edit`}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <Pencil size={15} />
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Product summary card */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-4 flex gap-3">
          <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center shrink-0">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Package size={26} className="text-slate-300 dark:text-slate-700" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-bold truncate">{item.name}</h1>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                  isOutOfStock
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                }`}
              >
                {isOutOfStock ? "Out of Stock" : "In Stock"}
              </span>
            </div>
            {item.categoryName && <p className="text-sm text-slate-500">{item.categoryName}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.trackExpiry && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  <Clock size={10} /> Perishable
                </span>
              )}
              {item.sku && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/30">
                  <Hash size={10} /> {item.sku}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setTab("batches")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              tab === "batches"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
            }`}
          >
            Batches
            <span className="opacity-70 text-[10px]">({batches.length})</span>
          </button>
          <button
            onClick={() => setTab("details")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === "details"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setTab("report")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              tab === "report"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
            }`}
          >
            <BarChart3 size={12} /> Report
          </button>
        </div>

        {tab === "report" ? (
          <ProductReportTab itemId={item.id} />
        ) : tab === "batches" ? (
          batches.length === 0 ? (
            <div className="py-16 text-center">
              <Archive size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p className="text-slate-500 text-sm">No stock batches yet. Add stock to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <Link
                  key={b.id}
                  href={`/owner/inventory/${item.id}/batches/${b.id}`}
                  className="flex items-center gap-3 bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 hover:border-blue-500/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
                    <Archive size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {new Date(b.addedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500">
                        Restocked <span className="text-slate-700 dark:text-slate-300 font-semibold">{b.originalQty}</span>
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          b.remainingQty > 0 ? "text-emerald-500" : "text-slate-500"
                        }`}
                      >
                        Available {b.remainingQty}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shrink-0 flex items-center gap-1 ${
                      b.isActive
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : "bg-slate-500/10 text-slate-500 border-slate-500/30"
                    }`}
                  >
                    {b.isActive && <CheckCircle2 size={10} />}
                    {b.isActive ? "Active" : "Depleted"}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {images.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Images</p>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.description && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Description</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Pricing</p>
              <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
                <Row label="Selling Price" value={`₦${item.price.toLocaleString()}`} />
                <Row label="Last Cost Price" value={item.costPrice != null ? `₦${item.costPrice.toLocaleString()}` : "—"} />
                <Row label="Margin" value={item.margin != null ? `${item.margin}%` : "—"} valueClassName="text-emerald-500 font-bold" />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Stock Info</p>
              <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
                <Row label="Current Stock" value={String(item.quantity)} />
                <Row label="Min Reorder Level" value={item.restockLevel != null ? String(item.restockLevel) : "—"} />
                <Row label="Type" value={item.trackExpiry ? "Perishable" : "Standard"} valueClassName={item.trackExpiry ? "text-amber-500 font-bold" : ""} />
                {item.trackExpiry && item.expiryDate && (
                  <Row label="Expiry Date" value={new Date(item.expiryDate).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} />
                )}
              </div>
            </div>

            {item.sku && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Identifiers</p>
                <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
                  <Row label="SKU" value={item.sku} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}