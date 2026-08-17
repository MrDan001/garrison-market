"use client";
// FILE: apps/frontend/app/staff/inventory/staff-scale-consignment-client.tsx (NEW FILE — replaces staff-scale-live-sell.tsx)

import { useState, useMemo } from "react";
import {
  Search, ShoppingCart, X, Package, Tag, ChevronRight, ChevronDown,
  AlertCircle, Trash2, Scale as ScaleIcon, Clock, CheckCircle2, Users,
} from "lucide-react";
import { sellFromScaleConsignmentAction } from "@/lib/consignment.actions";
import { convertToBaseUnit, unitsForBase, quantityFromAmount } from "@/lib/scale-units";
import CustomerFields from "@/components/CustomerFields";
import { getExpiryStatus } from "@/lib/expiry-status";

interface ConsignmentLine {
  consignmentItemId: number; // ScaleConsignmentItem id
  name: string;
  image?: string | null;
  baseUnit: string; // "kg" | "L"
  quantityOut: number;
  quantitySold: number;
  quantityWasted: number;
  remaining: number; // quantityOut - quantitySold - quantityWasted, what's actually sellable
  price: number; // per base unit
  isShared: boolean; // true when this came from a store-wide shared consignment (staffId: null)
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  trackExpiry?: boolean;
  expiryDate?: string | null;
}

interface ProductCategoryOption {
  id: number;
  name: string;
  itemCount: number;
}

interface CartLine extends ConsignmentLine {
  enteredQty: number;
  enteredUnit: string;
  baseQty: number; // derived amount that will be deducted
  linePrice: number; // per base unit, post-discount if any
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
}

const DISCOUNT_REASONS = [
  "Loyalty customer",
  "Damaged/spoiled portion",
  "Bulk purchase",
  "Clearance sale",
  "Staff discount",
  "Management approval",
  "Other",
];

export default function StaffScaleConsignmentClient({
  openConsignments,
  history,
  discountEnabled,
  categories = [],
}: {
  openConsignments: any[];
  history: any[];
  discountEnabled: boolean;
  categories?: ProductCategoryOption[];
}) {
  const [view, setView] = useState<"sell" | "history">("sell");
  const [tab, setTab] = useState<"all" | "out-of-stock" | "expiring">("all");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [drawerItem, setDrawerItem] = useState<ConsignmentLine | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [saleUnit, setSaleUnit] = useState<string>("");
  const [entryMode, setEntryMode] = useState<"qty" | "amount">("qty");
  const [amountInput, setAmountInput] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountReason, setDiscountReason] = useState(DISCOUNT_REASONS[0]);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Flatten every open consignment's scale lines into one sellable list —
  // this is the ONLY set of items a staff member can ever see/sell here,
  // since it's scoped to what's been signed out to them today.
  const allLines: ConsignmentLine[] = useMemo(
    () =>
      openConsignments.flatMap((c) =>
        c.scaleItems.map((i: any) => ({
          consignmentItemId: i.id,
          name: i.scaleInventory?.name ?? "Item",
          image: i.scaleInventory?.image ?? null,
          baseUnit: i.unit,
          quantityOut: Number(i.quantityOut),
          quantitySold: Number(i.quantitySold),
          quantityWasted: Number(i.quantityWasted ?? 0),
          remaining: Number(i.quantityOut) - Number(i.quantitySold) - Number(i.quantityWasted ?? 0),
          price: Number(i.priceAtTime),
          isShared: c.staffId === null,
          categoryId: i.scaleInventory?.categoryId ?? null,
          categoryName: i.scaleInventory?.categoryRef?.name ?? i.scaleInventory?.category ?? null,
          sku: i.scaleInventory?.sku ?? null,
          trackExpiry: i.scaleInventory?.trackExpiry ?? false,
          expiryDate: i.scaleInventory?.expiryDate ?? null,
        }))
      ),
    [openConsignments]
  );

  const outOfStockItems = useMemo(() => allLines.filter((i) => i.remaining <= 0), [allLines]);
  const expiringLines = useMemo(
    () => allLines.filter((i) => getExpiryStatus(i.trackExpiry, i.expiryDate) !== null),
    [allLines]
  );
  const tabFiltered = tab === "out-of-stock" ? outOfStockItems : tab === "expiring" ? expiringLines : allLines;
  const filteredItems = useMemo(() => {
    const byCategory = categoryId === "all" ? tabFiltered : tabFiltered.filter((item) => item.categoryId === categoryId);
    return byCategory.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tabFiltered, categoryId, searchQuery]);

  const selectedCategoryName = categoryId === "all" ? null : categories.find((c) => c.id === categoryId)?.name ?? null;

  const total = cart.reduce((sum, line) => sum + line.linePrice * line.baseQty, 0);
  const cartCount = cart.length;

  const tabs: { key: "all" | "out-of-stock" | "expiring"; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: "all", label: "All", count: allLines.length },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockItems.length },
    { key: "expiring", label: "Expiring Soon", count: expiringLines.length, icon: <Clock size={10} className="text-orange-500" /> },
  ];

  const openDrawer = (item: ConsignmentLine) => {
    const existing = cart.find((c) => c.consignmentItemId === item.consignmentItemId);
    setDrawerItem(item);
    setQtyInput(existing ? String(existing.enteredQty) : "");
    setSaleUnit(existing ? existing.enteredUnit : item.baseUnit);
    setEntryMode("qty");
    setAmountInput("");
    setShowDiscount(!!existing?.discountValue);
    setDiscountInput(existing?.discountValue ? String(existing.discountValue) : "");
    setDiscountType(existing?.discountType ?? "percent");
    setDiscountReason(existing?.discountReason ?? DISCOUNT_REASONS[0]);
    setDrawerError(null);
  };

  const closeDrawer = () => {
    setDrawerItem(null);
    setQtyInput("");
    setAmountInput("");
    setEntryMode("qty");
    setShowDiscount(false);
    setDiscountInput("");
    setDrawerError(null);
  };

  const unitPair = drawerItem ? unitsForBase(drawerItem.baseUnit) : null;
  const drawerCartItem = drawerItem ? cart.find((c) => c.consignmentItemId === drawerItem.consignmentItemId) : undefined;

  const qtyFromAmount = (): number | null => {
    if (!drawerItem) return null;
    const val = parseFloat(amountInput);
    if (isNaN(val) || val <= 0) return null;
    const qty = quantityFromAmount(val, drawerItem.price, saleUnit, drawerItem.baseUnit);
    return qty > 0 ? qty : null;
  };

  const effectiveQtyInput = entryMode === "amount" ? qtyFromAmount() : parseFloat(qtyInput);

  const computeBaseQty = (): number | null => {
    if (!drawerItem) return null;
    const val = effectiveQtyInput;
    if (val == null || isNaN(val) || val <= 0) return null;
    try {
      return convertToBaseUnit(val, saleUnit, drawerItem.baseUnit);
    } catch {
      return null;
    }
  };

  const baseQtyPreview = computeBaseQty();

  const computeDiscountedUnitPrice = (basePrice: number) => {
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) return basePrice;
    if (discountType === "percent") return Math.max(0, basePrice - (basePrice * Math.min(val, 100)) / 100);
    if (!baseQtyPreview || baseQtyPreview <= 0) return basePrice;
    return Math.max(0, basePrice - val / baseQtyPreview);
  };

  const previewUnitPrice = drawerItem ? computeDiscountedUnitPrice(drawerItem.price) : 0;
  const previewLineTotal = baseQtyPreview != null ? previewUnitPrice * baseQtyPreview : 0;
  const originalLineTotal = baseQtyPreview != null && drawerItem ? drawerItem.price * baseQtyPreview : 0;
  const savings = originalLineTotal - previewLineTotal;

  const handleAddFromDrawer = () => {
    if (!drawerItem) return;
    setDrawerError(null);

    const baseQty = computeBaseQty();
    if (baseQty == null) {
      setDrawerError("Enter a valid amount.");
      return;
    }
    if (baseQty > drawerItem.remaining) {
      setDrawerError(`Only ${drawerItem.remaining}${drawerItem.baseUnit} left of what's signed out to you.`);
      return;
    }

    const hasDiscount = discountEnabled && showDiscount && !isNaN(parseFloat(discountInput)) && parseFloat(discountInput) > 0;

    const line: CartLine = {
      ...drawerItem,
      enteredQty: entryMode === "amount" ? (qtyFromAmount() as number) : parseFloat(qtyInput),
      enteredUnit: saleUnit,
      baseQty,
      linePrice: hasDiscount ? previewUnitPrice : drawerItem.price,
      discountValue: hasDiscount ? parseFloat(discountInput) : undefined,
      discountType: hasDiscount ? discountType : undefined,
      discountReason: hasDiscount ? discountReason : undefined,
    };

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.consignmentItemId === drawerItem.consignmentItemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = line;
        return next;
      }
      return [...prev, line];
    });
    closeDrawer();
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((c) => c.consignmentItemId !== id));
  };

  const handleProcessSale = async () => {
    if (!paymentMethod) {
      setCheckoutError("Please select cash or transfer before confirming.");
      return;
    }
    setLoading(true);
    setCheckoutError(null);
    try {
      const payload = cart.map((line) => ({
        consignmentItemId: line.consignmentItemId,
        enteredQty: line.enteredQty,
        enteredUnit: line.enteredUnit,
        price: line.linePrice,
        ...(line.discountValue
          ? {
              originalPrice: line.price,
              discountValue: line.discountValue,
              discountType: line.discountType,
              discountReason: line.discountReason,
            }
          : {}),
      }));

      await sellFromScaleConsignmentAction(payload, paymentMethod, buyerName, buyerPhone);

      setCart([]);
      setShowCart(false);
      setPaymentMethod(null);
      setBuyerName("");
      setBuyerPhone("");
      setMsg("Sale completed successfully!");
    } catch (error: any) {
      setCheckoutError(error.message || "Failed to process sale.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-32">
      {/* Sell / History switch */}
      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setView("sell")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            view === "sell" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
          }`}
        >
          Sell
        </button>
        <button
          onClick={() => setView("history")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            view === "history" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
          }`}
        >
          History
        </button>
      </div>

      {view === "history" ? (
        <div className="p-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-8">No settled days yet.</p>
          ) : (
            history.map((c) => (
              <div key={c.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {new Date(c.settledAt ?? c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Clock size={10} /> SETTLED
                  </span>
                </div>
                {c.scaleItems.map((item: any) => (
                  <p key={item.id} className="text-xs text-slate-500">
                    {item.scaleInventory?.name}: {Number(item.quantitySold)}{item.unit} sold, {Number(item.quantityReturned)}{item.unit} returned
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-app)]/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
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
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  <span className="opacity-60 text-[10px]">({t.count})</span>
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
              <ScaleIcon size={20} className="text-blue-500" /> Signed Out to You
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filteredItems.length} items · tap a product to weigh out a sale</p>
          </div>

          {/* Grid */}
          <div className="px-4">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <ScaleIcon size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-slate-500 text-sm">
                  {searchQuery
                    ? `No items match "${searchQuery}"`
                    : allLines.length === 0
                    ? "Nothing has been signed out to you yet today."
                    : tab === "expiring"
                    ? "No items expiring soon."
                    : `No items in ${tab.replace("-", " ")}`}
                  {selectedCategoryName && allLines.length > 0 && ` (Category: ${selectedCategoryName})`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const cartLine = cart.find((c) => c.consignmentItemId === item.consignmentItemId);
                  const isOutOfStock = item.remaining <= 0;
                  const hasDiscount = !!cartLine?.discountValue;
                  const expiryStatus = getExpiryStatus(item.trackExpiry, item.expiryDate);

                  return (
                    <div
                      key={item.consignmentItemId}
                      onClick={() => !isOutOfStock && openDrawer(item)}
                      className={`relative bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer active:scale-[0.97] ${
                        isOutOfStock
                          ? "border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                          : cartLine
                          ? "border-blue-500/50 shadow-lg shadow-blue-500/10"
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
                        <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1 items-start">
                          {hasDiscount && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded-full">
                              DISCOUNT
                            </span>
                          )}
                          {expiryStatus && (
                            <span
                              className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                expiryStatus === "expired"
                                  ? "text-rose-400 bg-rose-950/80"
                                  : "text-orange-400 bg-orange-950/80"
                              }`}
                            >
                              <Clock size={9} />
                              {expiryStatus === "expired" ? "Expired" : "Expiring Soon"}
                            </span>
                          )}
                        </div>
                        {item.isShared && (
                          <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-bold text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded-full z-10">
                            <Users size={9} /> SHARED
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 flex-1 flex flex-col gap-1">
                        <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight">{item.name}</p>
                        {item.isShared && (
                          <p className="text-[10px] text-blue-400 flex items-center gap-1">
                            <Users size={10} /> Shared with all staff
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {item.remaining}{item.baseUnit} left · ₦{item.price.toLocaleString()}/{item.baseUnit}
                        </p>
                        {cartLine && (
                          <p className="text-[10px] font-semibold text-blue-400 mt-0.5">
                            In cart: {cartLine.enteredQty}{cartLine.enteredUnit}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {msg && <p className="px-4 pt-4 text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> {msg}</p>}
        </>
      )}

      {/* Weigh-out drawer */}
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
            <span className="font-bold text-[var(--text-primary)]">₦{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </button>
        </div>
      )}

      {drawerItem && (
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
                      <ScaleIcon size={22} className="text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight truncate">{drawerItem.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sold by {drawerItem.baseUnit}
                      {drawerItem.categoryName ? ` · ${drawerItem.categoryName}` : ""}
                    </p>
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
                <StatChip label="Price" value={`₦${drawerItem.price.toLocaleString()}/${drawerItem.baseUnit}`} />
                <StatChip label="Remaining" value={`${drawerItem.remaining}${drawerItem.baseUnit}`} />
                <StatChip
                  label="In Cart"
                  value={drawerCartItem ? `${drawerCartItem.enteredQty}${drawerCartItem.enteredUnit}` : "0"}
                  highlight={!!drawerCartItem}
                />
              </div>

              {/* Quantity + unit toggle, side by side in the same bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-500 block">
                    {entryMode === "amount" ? "Amount customer wants to spend" : "Quantity"}
                  </label>
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                    {(["qty", "amount"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEntryMode(m)}
                        className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                          entryMode === m ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500"
                        }`}
                      >
                        {m === "qty" ? `By ${drawerItem.baseUnit}` : "By ₦"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step={entryMode === "amount" ? "1" : "0.001"}
                    min={0}
                    inputMode="decimal"
                    placeholder="0"
                    value={entryMode === "amount" ? amountInput : qtyInput}
                    onChange={(e) => (entryMode === "amount" ? setAmountInput(e.target.value) : setQtyInput(e.target.value))}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600"
                  />
                  {unitPair && (
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0">
                      {[unitPair.base, unitPair.sub].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setSaleUnit(u)}
                          className={`px-3.5 py-2.5 text-xs font-bold transition-colors ${
                            saleUnit === u ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {entryMode === "amount" && effectiveQtyInput != null && (
                  <p className="text-[11px] text-emerald-400 font-semibold mt-1.5">
                    ≈ Weigh out {effectiveQtyInput}{saleUnit}
                  </p>
                )}
              </div>

              {discountEnabled && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 overflow-hidden">
                  <button
                    type="button"
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
                            type="button"
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
                          min={0}
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
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">New Price (per {drawerItem.baseUnit})</p>
                            <p className="text-lg font-bold text-emerald-400">₦{previewUnitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
                              type="button"
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
              )}

              {baseQtyPreview != null && (
                <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Line total</span>
                  <span className="font-bold text-[var(--text-primary)]">₦{previewLineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}

              {drawerError && (
                <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle size={12} /> {drawerError}</p>
              )}

              <button
                disabled={drawerItem.remaining <= 0}
                onClick={handleAddFromDrawer}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart size={17} />
                {showDiscount && savings > 0 && baseQtyPreview != null
                  ? `Add at ₦${previewLineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart / checkout — styled to match the main (List) staff checkout */}
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
              {cart.map((line) => (
                <div key={line.consignmentItemId} className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {line.image ? (
                        <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={16} className="text-slate-400 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{line.name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-slate-500">
                          {line.enteredQty}
                          {line.enteredUnit} · ₦{(line.linePrice * line.baseQty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        {line.discountValue && (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">DISC</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(line.consignmentItemId)} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-rose-400 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mb-5 flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-[var(--text-primary)]">₦{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            {/* Customer Details Fields */}
            <div className="mb-5 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Customer Details (Optional)</p>
              <CustomerFields
                name={buyerName}
                phone={buyerPhone}
                onNameChange={setBuyerName}
                onPhoneChange={setBuyerPhone}
              />
            </div>

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

            {checkoutError && (
              <p className="text-xs text-rose-400 flex items-center gap-1 mb-3"><AlertCircle size={12} /> {checkoutError}</p>
            )}

            <button
              disabled={loading || cart.length === 0 || !paymentMethod}
              onClick={handleProcessSale}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:opacity-60 py-4 rounded-2xl font-bold text-white transition-colors shadow-lg shadow-emerald-900/10"
            >
              {loading ? "Processing..." : !paymentMethod ? "Select payment method" : "Confirm Sale"}
            </button>
          </div>
        </div>
      )}
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