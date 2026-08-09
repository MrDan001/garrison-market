"use client";
// app/staff/inventory/inventory-client.tsx

import { useState, useMemo } from "react";
import {
  ArrowLeft, Search, ShoppingCart, Plus, Minus,
  X, Package, Tag, ChevronRight, ChevronDown, AlertCircle, Flame, Clock,
} from "lucide-react";
import Link from "next/link";
import { processSaleAction } from "@/lib/business.actions";
import PartPaymentFields, { validatePartPayment } from "@/components/PartPaymentFields";
import { getExpiryStatus } from "@/lib/expiry-status";

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  costPrice?: number;
  category?: string; // legacy string — used only if categoryName isn't set
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  trackExpiry?: boolean;
  expiryDate?: string | null;
  image?: string;
  restockLevel?: number; // Added to support Low Stock detection
  salesCount?: number;    // Added to support Top Selling logic
}

interface ProductCategoryOption {
  id: number;
  name: string;
  itemCount: number;
}

interface CartItem extends InventoryItem {
  qty: number;
  finalPrice: number;
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
}

type Tab = "all" | "low-stock" | "out-of-stock" | "expiring" | "top-selling";

const DISCOUNT_REASONS = [
  "Loyalty customer",
  "Damaged packaging",
  "Bulk purchase",
  "Clearance sale",
  "Staff discount",
  "Management approval",
  "Other",
];

export default function InventoryClient({
  initialItems,
  discountEnabled,
  categories = [],
}: {
  initialItems: InventoryItem[];
  discountEnabled: boolean;
  categories?: ProductCategoryOption[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [drawerItem, setDrawerItem] = useState<InventoryItem | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountReason, setDiscountReason] = useState(DISCOUNT_REASONS[0]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"full" | "partial">("full");
  const [amountPaidInput, setAmountPaidInput] = useState("");

  // New state tracking for customer records
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Derived filter categories
  const outOfStockItems = useMemo(() => {
    return initialItems.filter((i) => i.quantity <= 0);
  }, [initialItems]);
  
  const lowStockItems = useMemo(() => {
    return initialItems.filter((i) => i.quantity > 0 && i.restockLevel != null && i.quantity <= i.restockLevel);
  }, [initialItems]);

  const topSellingItems = useMemo(() => {
    return [...initialItems].sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
  }, [initialItems]);

  // Includes both "expiring soon" and already-expired items — staff need to
  // know about both so they can flag or pull stock before selling it.
  const expiringItems = useMemo(() => {
    return initialItems.filter((i) => getExpiryStatus(i.trackExpiry, i.expiryDate) !== null);
  }, [initialItems]);

  // Determine active list based on selected tab
  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "low-stock":
        return lowStockItems;
      case "out-of-stock":
        return outOfStockItems;
      case "expiring":
        return expiringItems;
      case "top-selling":
        return topSellingItems;
      case "all":
      default:
        return initialItems;
    }
  }, [tab, initialItems, lowStockItems, outOfStockItems, expiringItems, topSellingItems]);

  const filteredItems = useMemo(() => {
    const byCategory = categoryId === "all" ? tabFiltered : tabFiltered.filter((item) => item.categoryId === categoryId);
    return byCategory.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tabFiltered, categoryId, searchQuery]);

  const selectedCategoryName = categoryId === "all" ? null : categories.find((c) => c.id === categoryId)?.name ?? null;

  const addToCart = (
    item: InventoryItem,
    finalPrice?: number,
    discountValue?: number,
    discountType?: "percent" | "flat",
    reason?: string
  ) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const currentQty = existing ? existing.qty : 0;
      if (currentQty >= item.quantity) return prev;
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1, finalPrice: finalPrice ?? item.price, discountValue, discountType, discountReason: reason }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.finalPrice * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleProcessSale = async () => {
    if (!paymentMethod) {
      alert("Please select cash or transfer before confirming.");
      return;
    }

    const validationError = validatePartPayment(paymentStatus, amountPaidInput, total, customerName, customerPhone);
    if (validationError) {
      alert(validationError);
      return;
    }
    const parsedAmountPaid = paymentStatus === "partial" ? parseFloat(amountPaidInput) : undefined;

    setLoading(true);
    try {
      const payload = cart.map((item) => ({
        ...item,
        originalPrice: item.price,
        price: item.finalPrice,
      }));

      await processSaleAction(
        payload,
        paymentMethod,
        customerName,
        customerPhone,
        paymentStatus,
        parsedAmountPaid
      );

      setCart([]);
      setShowCart(false);
      setPaymentMethod(null);
      setPaymentStatus("full");
      setAmountPaidInput("");
      setCustomerName("");
      setCustomerPhone("");
      alert(
        paymentStatus === "partial"
          ? "Sale completed — part payment logged as a debt."
          : "Sale completed successfully!"
      );
    } catch (error: any) {
      alert(error.message || "Failed to process sale.");
    } finally {
      setLoading(false);
    }
  };

  const computeDiscountedPrice = (basePrice: number) => {
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) return basePrice;
    if (discountType === "percent") return Math.max(0, basePrice - (basePrice * Math.min(val, 100)) / 100);
    return Math.max(0, basePrice - val);
  };

  const previewPrice = drawerItem ? computeDiscountedPrice(drawerItem.price) : 0;
  const savings = drawerItem ? drawerItem.price - previewPrice : 0;

  const handleAddFromDrawer = () => {
    if (!drawerItem) return;
    const discountVal = parseFloat(discountInput);
    const hasDiscount = showDiscount && !isNaN(discountVal) && discountVal > 0;
    addToCart(
      drawerItem,
      hasDiscount ? previewPrice : drawerItem.price,
      hasDiscount ? discountVal : undefined,
      hasDiscount ? discountType : undefined,
      hasDiscount ? discountReason : undefined
    );
    closeDrawer();
  };

  const openDrawer = (item: InventoryItem) => {
    setDrawerItem(item);
    setShowDiscount(false);
    setDiscountInput("");
    setDiscountType("percent");
    setDiscountReason(DISCOUNT_REASONS[0]);
  };

  const closeDrawer = () => { setDrawerItem(null); setShowDiscount(false); setDiscountInput(""); };
  const drawerCartItem = drawerItem ? cart.find((c) => c.id === drawerItem.id) : null;

  // Tabs configuration
  const tabs: { key: Tab; label: string; count?: number; icon?: React.ReactNode }[] = [
    { key: "all", label: "All", count: initialItems.length },
    { key: "low-stock", label: "Low Stock", count: lowStockItems.length },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockItems.length },
    { key: "expiring", label: "Expiring Soon", count: expiringItems.length, icon: <Clock size={10} className="text-orange-500" /> },
 /*   { key: "top-selling", label: "Top Selling", icon: <Flame size={10} className="text-amber-500" /> }, */
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-32">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-app)]/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/staff/dashboard" className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={() => cart.length > 0 && setShowCart(true)}
            className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ShoppingCart size={16} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center z-10">
                {cartCount}
              </span>
            )}
          </button>
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
                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200 border border-slate-200/85 dark:border-slate-800/85"
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
        {/* Category Filter Dropdown — populated from owner-created categories */}
        {categories.length > 0 && (
          <div className="relative">
            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
            <select
              value={categoryId === "all" ? "all" : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full appearance-none bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
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
      </div>

      {/* Title */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Package size={20} className="text-blue-500" /> Inventory
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {filteredItems.length} items · {discountEnabled ? "tap a product to view details" : "tap + to add to cart"}
        </p>
      </div>

      {/* Grid */}
      <div className="px-4">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 text-sm">
              {searchQuery ? `No items match "${searchQuery}"` : tab === "expiring" ? "No items expiring soon." : `No items in ${tab.replace("-", " ")}`}
              {selectedCategoryName && ` (Category: ${selectedCategoryName})`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => {
              const cartItem = cart.find((c) => c.id === item.id);
              const isOutOfStock = item.quantity <= 0;
              const isLowStock = !isOutOfStock && item.restockLevel != null && item.quantity <= item.restockLevel;
              const expiryStatus = getExpiryStatus(item.trackExpiry, item.expiryDate);
              const qtyInCart = cartItem?.qty || 0;

              if (!discountEnabled) {
                return (
                  <SimpleCard
                    key={item.id}
                    item={item}
                    qtyInCart={qtyInCart}
                    isOutOfStock={isOutOfStock}
                    isLowStock={isLowStock}
                    expiryStatus={expiryStatus}
                    onAdd={() => addToCart(item)}
                    onRemove={() => removeFromCart(item.id)}
                    tab={tab}
                  />
                );
              }

              const hasDiscount = cartItem?.discountValue !== undefined;

              return (
                <div
                  key={item.id}
                  onClick={() => !isOutOfStock && openDrawer(item)}
                  className={`relative bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer active:scale-[0.97] ${
                    isOutOfStock ? "border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                      : qtyInCart > 0 ? "border-blue-500/50 shadow-lg shadow-blue-500/10"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:dark:border-slate-700"
                  }`}
                >
                  <div className="relative bg-slate-50 dark:bg-slate-950 aspect-square flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                        <Package size={24} className="text-slate-500" />
                      </div>
                    )}
                    
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full">OUT OF STOCK</span>
                      </div>
                    )}

                    {isLowStock && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                          Low Stock
                        </span>
                      </div>
                    )}

                    {expiryStatus && (
                      <div className={`absolute ${isLowStock ? "top-8" : "top-2"} left-2 z-10`}>
                        <span
                          className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            expiryStatus === "expired"
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                              : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                          }`}
                        >
                          <Clock size={9} />
                          {expiryStatus === "expired" ? "Expired" : "Expiring Soon"}
                        </span>
                      </div>
                    )}

                    {qtyInCart > 0 && (
                      <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
                        {qtyInCart}
                      </div>
                    )}

                    {hasDiscount && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center z-10">
                        <Tag size={10} />
                      </div>
                    )}

                    {/* Flame Hot Badge for Top Selling items */}
                    {tab === "top-selling" && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-amber-500 text-slate-50 dark:text-slate-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                        <Flame size={10} fill="currentColor" /> {item.salesCount ?? 0} sold
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.quantity} in stock</p>
                    <div className="mt-auto flex items-center justify-between">
                      <p className="text-sm font-bold text-blue-400">
                        ₦{(cartItem?.finalPrice ?? item.price).toLocaleString()}
                      </p>
                      {!isOutOfStock && <ChevronRight size={14} className="text-slate-400 dark:text-slate-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating checkout */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-app)]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-2xl px-5 py-4 transition-all shadow-lg shadow-emerald-900/10"
          >
            <span className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
              <ShoppingCart size={18} />
              {cartCount} item{cartCount !== 1 ? "s" : ""}
            </span>
            <span className="font-bold text-[var(--text-primary)]">₦{total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Product Drawer — discount mode only */}
      {discountEnabled && drawerItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative w-full bg-[var(--bg-surface)] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl z-10 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="px-5 pb-8 pt-3 space-y-5">
              {/* Product header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {drawerItem.image ? (
                      <img src={drawerItem.image} alt={drawerItem.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={22} className="text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate">{drawerItem.name}</h2>
                    {(drawerItem.categoryName ?? drawerItem.category) && (
                      <p className="text-xs text-slate-500 mt-0.5">{drawerItem.categoryName ?? drawerItem.category}</p>
                    )}
                    {(() => {
                      const status = getExpiryStatus(drawerItem.trackExpiry, drawerItem.expiryDate);
                      if (!status) return null;
                      return (
                        <p className={`flex items-center gap-1 text-xs mt-1 font-semibold ${status === "expired" ? "text-rose-400" : "text-orange-400"}`}>
                          <Clock size={11} />
                          {status === "expired" ? "Expired" : "Expiring soon"}
                          {drawerItem.expiryDate && ` · ${new Date(drawerItem.expiryDate).toLocaleDateString()}`}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <button onClick={closeDrawer} className="p-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="Price" value={`₦${drawerItem.price.toLocaleString()}`} />
                <StatChip label="In Stock" value={drawerItem.quantity.toString()} />
                <StatChip label="In Cart" value={(drawerCartItem?.qty || 0).toString()} highlight={!!drawerCartItem} />
              </div>

              {/* Discount section */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 overflow-hidden">
                <button
                  onClick={() => setShowDiscount((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Tag size={14} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Apply Discount</p>
                      {showDiscount && savings > 0 && (
                        <p className="text-xs text-emerald-400">Saving ₦{savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-slate-500 transition-transform ${showDiscount ? "rotate-90" : ""}`} />
                </button>

                {showDiscount && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200/60 dark:border-slate-800/60">
                    {/* Type pills */}
                    <div className="flex gap-2 mt-3">
                      {(["percent", "flat"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDiscountType(t)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            discountType === t ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {t === "percent" ? "% Percentage" : "₦ Flat Amount"}
                        </button>
                      ))}
                    </div>

                    {/* Input */}
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                        {discountType === "percent" ? "%" : "₦"}
                      </span>
                      <input
                        type="number"
                        placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 500"}
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-8 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    {/* Live preview */}
                    {discountInput && (
                      <div className="flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">New Price</p>
                          <p className="text-lg font-bold text-emerald-400">₦{previewPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">You save</p>
                          <p className="text-lg font-bold text-[var(--text-primary)]">₦{savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                    )}

                    {/* Reasons */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5 font-medium">Reason</p>
                      <div className="flex flex-wrap gap-2">
                        {DISCOUNT_REASONS.map((r) => (
                          <button
                            key={r}
                            onClick={() => setDiscountReason(r)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              discountReason === r ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {discountType === "percent" && parseFloat(discountInput) > 100 && (
                      <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                        <AlertCircle size={13} />
                        Percentage cannot exceed 100%
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add to cart / controls */}
              {drawerCartItem ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3">
                    <button
                      onClick={() => removeFromCart(drawerItem.id)}
                      className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-xl font-bold text-[var(--text-primary)]">{drawerCartItem.qty}</span>
                    <button
                      onClick={() => addToCart(drawerItem)}
                      disabled={drawerCartItem.qty >= drawerItem.quantity}
                      className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={closeDrawer}
                    className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 text-[var(--text-primary)] transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  disabled={drawerItem.quantity <= 0}
                  onClick={handleAddFromDrawer}
                  className="w-full py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={17} />
                  {showDiscount && savings > 0
                    ? `Add at ₦${previewPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "Add to Cart"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative w-full bg-[var(--bg-surface)] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ShoppingCart size={20} /> Checkout
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={16} className="text-slate-400 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-slate-500">₦{item.finalPrice.toLocaleString()} each</p>
                        {item.discountValue && (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">DISC</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeFromCart(item.id)} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors">
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-[var(--text-primary)]">{item.qty}</span>
                    <button onClick={() => addToCart(item)} disabled={item.qty >= item.quantity} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors disabled:opacity-30">
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[var(--text-primary)] shrink-0 w-20 text-right">
                    ₦{(item.finalPrice * item.qty).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mb-5 flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-[var(--text-primary)]">₦{total.toLocaleString()}</span>
            </div>

            {/* Customer Details Fields */}
            <div className="mb-5 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Customer Details {paymentStatus === "partial" ? "(Required for part payment)" : "(Optional)"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${
                    paymentStatus === "partial" && !customerName.trim() ? "border-amber-500/60" : "border-slate-200 dark:border-slate-800"
                  }`}
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${
                    paymentStatus === "partial" && !customerPhone.trim() ? "border-amber-500/60" : "border-slate-200 dark:border-slate-800"
                  }`}
                />
              </div>
            </div>

            <PartPaymentFields
              paymentStatus={paymentStatus}
              onPaymentStatusChange={setPaymentStatus}
              amountPaid={amountPaidInput}
              onAmountPaidChange={setAmountPaidInput}
              total={total}
            />

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    paymentMethod === "cash" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("transfer")}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    paymentMethod === "transfer" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  🏦 Transfer
                </button>
              </div>
            </div>

            {(() => {
              const partialError = validatePartPayment(paymentStatus, amountPaidInput, total, customerName, customerPhone);
              const disabled = loading || !paymentMethod || !!partialError;
              const label = loading
                ? "Processing..."
                : !paymentMethod
                ? "Select payment method"
                : partialError
                ? "Complete part payment details"
                : paymentStatus === "partial"
                ? "Confirm Sale (Part Payment)"
                : "Confirm Sale";

              return (
                <button
                  disabled={disabled}
                  onClick={handleProcessSale}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:opacity-60 py-4 rounded-2xl font-bold text-white transition-colors shadow-lg shadow-emerald-900/10"
                >
                  {label}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Small global utility style to hide horizontal scroll scrollbar */}
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

function StatChip({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${highlight ? "border-blue-500/30 bg-blue-500/10" : "border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60"}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${highlight ? "text-blue-400" : "text-[var(--text-primary)]"}`}>{value}</p>
    </div>
  );
}

function SimpleCard({
  item,
  qtyInCart,
  isOutOfStock,
  isLowStock,
  expiryStatus,
  onAdd,
  onRemove,
  tab,
}: {
  item: InventoryItem;
  qtyInCart: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  expiryStatus: "expired" | "soon" | null;
  onAdd: () => void;
  onRemove: () => void;
  tab: Tab;
}) {
  return (
    <div
      className={`relative bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all ${
        isOutOfStock ? "border-slate-200 dark:border-slate-800 opacity-50"
          : qtyInCart > 0 ? "border-blue-500/50 shadow-lg shadow-blue-500/10"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:dark:border-slate-700"
      }`}
    >
      <div className="relative bg-slate-50 dark:bg-slate-950 aspect-square flex items-center justify-center overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            <Package size={24} className="text-slate-500" />
          </div>
        )}
        
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full">OUT OF STOCK</span>
          </div>
        )}

        {isLowStock && (
          <div className="absolute top-2 left-2 z-10">
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              Low Stock
            </span>
          </div>
        )}

        {expiryStatus && (
          <div className={`absolute ${isLowStock ? "top-8" : "top-2"} left-2 z-10`}>
            <span
              className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                expiryStatus === "expired"
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  : "bg-orange-500/20 text-orange-400 border-orange-500/30"
              }`}
            >
              <Clock size={9} />
              {expiryStatus === "expired" ? "Expired" : "Expiring Soon"}
            </span>
          </div>
        )}

        {/* Flame Hot Badge for Top Selling items */}
        {tab === "top-selling" && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-amber-500 text-slate-50 dark:text-slate-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
            <Flame size={10} fill="currentColor" /> {item.salesCount ?? 0} sold
          </div>
        )}

        {!isOutOfStock && qtyInCart === 0 && (
          <button
            onClick={onAdd}
            aria-label={`Add ${item.name} to cart`}
            className="absolute bottom-2 right-2 z-10 h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex items-center justify-center text-white shadow-lg shadow-black/30 transition-all"
          >
            <ShoppingCart size={16} />
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">{item.name}</p>
        <p className="text-xs text-slate-500">{item.quantity} in stock</p>
        <p className="mt-auto text-sm font-bold text-blue-400">₦{item.price.toLocaleString()}</p>
      </div>

      {qtyInCart > 0 && (
        <div className="flex items-center justify-center gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-3 py-2">
          <button
            onClick={onRemove}
            className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center text-[var(--text-primary)] transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="text-sm font-bold text-[var(--text-primary)] w-5 text-center">{qtyInCart}</span>
          <button
            onClick={onAdd}
            disabled={qtyInCart >= item.quantity}
            className="h-7 w-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}