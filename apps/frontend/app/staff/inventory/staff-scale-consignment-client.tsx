"use client";
// FILE: apps/frontend/app/staff/inventory/staff-scale-consignment-client.tsx (NEW FILE — replaces staff-scale-live-sell.tsx)

import { useState, useMemo } from "react";
import {
  Search, ShoppingCart, X, Package, ChevronRight,
  AlertCircle, Trash2, Scale as ScaleIcon, Clock, CheckCircle2,
} from "lucide-react";
import { sellFromScaleConsignmentAction } from "@/lib/consignment.actions";
import { convertToBaseUnit, unitsForBase } from "@/lib/scale-units";

interface ConsignmentLine {
  consignmentItemId: number; // ScaleConsignmentItem id
  name: string;
  image?: string | null;
  baseUnit: string; // "kg" | "L"
  quantityOut: number;
  quantitySold: number;
  remaining: number; // quantityOut - quantitySold, what's actually sellable
  price: number; // per base unit
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
}: {
  openConsignments: any[];
  history: any[];
  discountEnabled: boolean;
}) {
  const [view, setView] = useState<"sell" | "history">("sell");
  const [tab, setTab] = useState<"all" | "out-of-stock">("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [drawerItem, setDrawerItem] = useState<ConsignmentLine | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [saleUnit, setSaleUnit] = useState<string>("");
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
          remaining: Number(i.quantityOut) - Number(i.quantitySold),
          price: Number(i.priceAtTime),
        }))
      ),
    [openConsignments]
  );

  const outOfStockItems = useMemo(() => allLines.filter((i) => i.remaining <= 0), [allLines]);
  const tabFiltered = tab === "out-of-stock" ? outOfStockItems : allLines;
  const filteredItems = useMemo(
    () => tabFiltered.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [tabFiltered, searchQuery]
  );

  const total = cart.reduce((sum, line) => sum + line.linePrice * line.baseQty, 0);
  const cartCount = cart.length;

  const tabs: { key: "all" | "out-of-stock"; label: string; count: number }[] = [
    { key: "all", label: "All", count: allLines.length },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockItems.length },
  ];

  const openDrawer = (item: ConsignmentLine) => {
    const existing = cart.find((c) => c.consignmentItemId === item.consignmentItemId);
    setDrawerItem(item);
    setQtyInput(existing ? String(existing.enteredQty) : "");
    setSaleUnit(existing ? existing.enteredUnit : item.baseUnit);
    setShowDiscount(!!existing?.discountValue);
    setDiscountInput(existing?.discountValue ? String(existing.discountValue) : "");
    setDiscountType(existing?.discountType ?? "percent");
    setDiscountReason(existing?.discountReason ?? DISCOUNT_REASONS[0]);
    setDrawerError(null);
  };

  const closeDrawer = () => {
    setDrawerItem(null);
    setQtyInput("");
    setShowDiscount(false);
    setDiscountInput("");
    setDrawerError(null);
  };

  const unitPair = drawerItem ? unitsForBase(drawerItem.baseUnit) : null;

  const computeBaseQty = (): number | null => {
    if (!drawerItem) return null;
    const val = parseFloat(qtyInput);
    if (isNaN(val) || val <= 0) return null;
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
      enteredQty: parseFloat(qtyInput),
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
                  <span>{t.label}</span>
                  <span className="opacity-60 text-[10px]">({t.count})</span>
                </button>
              ))}
            </div>
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
                    : `No items in ${tab.replace("-", " ")}`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const cartLine = cart.find((c) => c.consignmentItemId === item.consignmentItemId);
                  const isOutOfStock = item.remaining <= 0;
                  const hasDiscount = !!cartLine?.discountValue;

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
                        {hasDiscount && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded-full z-10">
                            DISCOUNT
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 flex-1 flex flex-col gap-1">
                        <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight">{item.name}</p>
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
      {drawerItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="relative w-full sm:max-w-md bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{drawerItem.name}</h2>
              <button onClick={closeDrawer} className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {drawerItem.remaining}{drawerItem.baseUnit} left of what's signed out to you · ₦{drawerItem.price.toLocaleString()}/{drawerItem.baseUnit}
            </p>

            {/* Quantity + unit toggle, side by side in the same bar */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  inputMode="decimal"
                  placeholder="0"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
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
            </div>

            {discountEnabled && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDiscount((s) => !s)}
                  className="text-xs font-semibold text-blue-500"
                >
                  {showDiscount ? "Remove discount" : "+ Add discount"}
                </button>
                {showDiscount && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        placeholder={discountType === "percent" ? "%" : "₦ off"}
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-600"
                      />
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0">
                        {(["percent", "flat"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setDiscountType(t)}
                            className={`px-3 py-2 text-xs font-bold ${discountType === t ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500"}`}
                          >
                            {t === "percent" ? "%" : "₦"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <select
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs outline-none"
                    >
                      {DISCOUNT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {savings > 0 && (
                      <p className="text-[11px] text-emerald-400">Saves ₦{savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
              onClick={handleAddFromDrawer}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* Cart / checkout */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="relative w-full sm:max-w-md bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Cart ({cartCount})</h2>
              <button onClick={() => setShowCart(false)} className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {cart.map((line) => (
                <div key={line.consignmentItemId} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{line.name}</p>
                    <p className="text-xs text-slate-500">{line.enteredQty}{line.enteredUnit} · ₦{(line.linePrice * line.baseQty).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <button onClick={() => removeFromCart(line.consignmentItemId)} className="text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Total</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">₦{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Payment method</label>
              <div className="flex gap-2">
                {(["cash", "transfer"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaymentMethod(p)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize ${
                      paymentMethod === p ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Buyer name (optional)"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-600"
              />
              <input
                type="text"
                placeholder="Buyer phone (optional)"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-600"
              />
            </div>

            {checkoutError && (
              <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle size={12} /> {checkoutError}</p>
            )}

            <button
              onClick={handleProcessSale}
              disabled={loading || cart.length === 0}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              {loading ? "Processing..." : `Confirm Sale · ₦${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              {!loading && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}