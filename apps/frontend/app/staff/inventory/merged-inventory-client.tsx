"use client";
// app/staff/inventory/merged-inventory-client.tsx
//
// Rendered instead of StaffInventoryModeSwitcher when the owner has BOTH
// scaleConsignmentEnabled and mergedCartEnabled on (admin-only overrides).
// Unlike the switcher, this shows one catalog toggle for BROWSING but a
// single shared cart — a staff member can add standard Inventory items and
// consignment-signed-out Scale items to the same sale and check out once,
// via processMergedSaleAction.

import { useState, useMemo } from "react";
import {
  ArrowLeft, Search, ShoppingCart, Plus, Minus, X, Package, Tag,
  AlertCircle, Trash2, List, Scale as ScaleIcon,
} from "lucide-react";
import Link from "next/link";
import { processMergedSaleAction } from "@/lib/consignment.actions";
import { convertToBaseUnit, unitsForBase, quantityFromAmount } from "@/lib/scale-units";
import CustomerFields from "@/components/CustomerFields";

interface ListItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  image?: string;
  restockLevel?: number;
}

interface ScaleLine {
  consignmentItemId: number;
  name: string;
  image?: string | null;
  baseUnit: string;
  remaining: number;
  price: number; // per base unit
}

interface ListCartLine {
  kind: "list";
  id: number;
  name: string;
  image?: string | null;
  qty: number;
  price: number; // post-discount unit price
  originalPrice?: number;
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
  maxQty: number;
}

interface ScaleCartLine {
  kind: "scale";
  consignmentItemId: number;
  name: string;
  image?: string | null;
  baseUnit: string;
  enteredQty: number;
  enteredUnit: string;
  baseQty: number;
  linePrice: number; // per base unit, post-discount
  discountValue?: number;
  discountType?: "percent" | "flat";
  discountReason?: string;
  remaining: number;
}

type CartLine = ListCartLine | ScaleCartLine;

const DISCOUNT_REASONS = [
  "Loyalty customer",
  "Damaged/spoiled portion",
  "Bulk purchase",
  "Clearance sale",
  "Staff discount",
  "Management approval",
  "Other",
];

export default function MergedInventoryClient({
  listItems,
  discountEnabled,
  scaleOpenConsignments,
}: {
  listItems: ListItem[];
  discountEnabled: boolean;
  scaleOpenConsignments: any[];
}) {
  const [catalog, setCatalog] = useState<"list" | "scale">("list");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  // --- Drawer state (shared between both item kinds) ---
  const [drawerListItem, setDrawerListItem] = useState<ListItem | null>(null);
  const [drawerScaleItem, setDrawerScaleItem] = useState<ScaleLine | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [saleUnit, setSaleUnit] = useState<string>("");
  const [entryMode, setEntryMode] = useState<"qty" | "amount">("qty");
  const [amountInput, setAmountInput] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountReason, setDiscountReason] = useState(DISCOUNT_REASONS[0]);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const scaleLines: ScaleLine[] = useMemo(
    () =>
      scaleOpenConsignments.flatMap((c) =>
        c.scaleItems.map((i: any) => ({
          consignmentItemId: i.id,
          name: i.scaleInventory?.name ?? "Item",
          image: i.scaleInventory?.image ?? null,
          baseUnit: i.unit,
          remaining: Number(i.quantityOut) - Number(i.quantitySold) - Number(i.quantityWasted ?? 0),
          price: Number(i.priceAtTime),
        }))
      ),
    [scaleOpenConsignments]
  );

  const filteredListItems = useMemo(
    () => listItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [listItems, searchQuery]
  );
  const filteredScaleLines = useMemo(
    () => scaleLines.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [scaleLines, searchQuery]
  );

  const cartCount = cart.reduce((sum, l) => sum + (l.kind === "list" ? l.qty : 1), 0);
  const total = cart.reduce(
    (sum, l) => sum + (l.kind === "list" ? l.price * l.qty : l.linePrice * l.baseQty),
    0
  );

  // --- List item add/remove (simple stepper, no drawer needed unless discounting) ---
  const qtyInCart = (id: number) => {
    const line = cart.find((l) => l.kind === "list" && l.id === id) as ListCartLine | undefined;
    return line?.qty ?? 0;
  };

  const addListItem = (item: ListItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.kind === "list" && l.id === item.id);
      if (idx >= 0) {
        const existing = prev[idx] as ListCartLine;
        if (existing.qty >= item.quantity) return prev;
        const next = [...prev];
        next[idx] = { ...existing, qty: existing.qty + 1 };
        return next;
      }
      if (item.quantity <= 0) return prev;
      return [
        ...prev,
        { kind: "list", id: item.id, name: item.name, image: item.image, qty: 1, price: item.price, maxQty: item.quantity },
      ];
    });
  };

  const removeListItem = (id: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.kind === "list" && l.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.kind !== "list" || l.qty > 0)
    );
  };

  // --- Scale drawer (weight/volume entry always goes through the drawer) ---
  const openScaleDrawer = (item: ScaleLine) => {
    const existing = cart.find((l) => l.kind === "scale" && l.consignmentItemId === item.consignmentItemId) as
      | ScaleCartLine
      | undefined;
    setDrawerScaleItem(item);
    setDrawerListItem(null);
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
    setDrawerListItem(null);
    setDrawerScaleItem(null);
    setQtyInput("");
    setAmountInput("");
    setEntryMode("qty");
    setShowDiscount(false);
    setDiscountInput("");
    setDrawerError(null);
  };

  const qtyFromAmount = (): number | null => {
    if (!drawerScaleItem) return null;
    const val = parseFloat(amountInput);
    if (isNaN(val) || val <= 0) return null;
    const qty = quantityFromAmount(val, drawerScaleItem.price, saleUnit, drawerScaleItem.baseUnit);
    return qty > 0 ? qty : null;
  };

  const effectiveQtyInput = entryMode === "amount" ? qtyFromAmount() : parseFloat(qtyInput);

  const computeBaseQty = (): number | null => {
    if (!drawerScaleItem) return null;
    const val = effectiveQtyInput;
    if (val == null || isNaN(val) || val <= 0) return null;
    try {
      return convertToBaseUnit(val, saleUnit, drawerScaleItem.baseUnit);
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

  const previewUnitPrice = drawerScaleItem ? computeDiscountedUnitPrice(drawerScaleItem.price) : 0;
  const previewLineTotal = baseQtyPreview != null ? previewUnitPrice * baseQtyPreview : 0;

  const handleAddScaleFromDrawer = () => {
    if (!drawerScaleItem) return;
    setDrawerError(null);

    const baseQty = computeBaseQty();
    if (baseQty == null) {
      setDrawerError("Enter a valid amount.");
      return;
    }
    if (baseQty > drawerScaleItem.remaining) {
      setDrawerError(`Only ${drawerScaleItem.remaining}${drawerScaleItem.baseUnit} left of what's signed out to you.`);
      return;
    }

    const hasDiscount = discountEnabled && showDiscount && !isNaN(parseFloat(discountInput)) && parseFloat(discountInput) > 0;

    const line: ScaleCartLine = {
      kind: "scale",
      consignmentItemId: drawerScaleItem.consignmentItemId,
      name: drawerScaleItem.name,
      image: drawerScaleItem.image,
      baseUnit: drawerScaleItem.baseUnit,
      enteredQty: entryMode === "amount" ? (qtyFromAmount() as number) : parseFloat(qtyInput),
      enteredUnit: saleUnit,
      baseQty,
      linePrice: hasDiscount ? previewUnitPrice : drawerScaleItem.price,
      discountValue: hasDiscount ? parseFloat(discountInput) : undefined,
      discountType: hasDiscount ? discountType : undefined,
      discountReason: hasDiscount ? discountReason : undefined,
      remaining: drawerScaleItem.remaining,
    };

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.kind === "scale" && l.consignmentItemId === drawerScaleItem.consignmentItemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = line;
        return next;
      }
      return [...prev, line];
    });
    closeDrawer();
  };

  const removeScaleLine = (consignmentItemId: number) => {
    setCart((prev) => prev.filter((l) => !(l.kind === "scale" && l.consignmentItemId === consignmentItemId)));
  };

  const handleProcessSale = async () => {
    if (!paymentMethod) {
      setCheckoutError("Please select cash or transfer before confirming.");
      return;
    }
    setLoading(true);
    setCheckoutError(null);
    try {
      const listPayload = cart
        .filter((l): l is ListCartLine => l.kind === "list")
        .map((l) => ({ id: l.id, qty: l.qty, price: l.price, originalPrice: l.originalPrice, discountValue: l.discountValue, discountType: l.discountType, discountReason: l.discountReason }));

      const scalePayload = cart
        .filter((l): l is ScaleCartLine => l.kind === "scale")
        .map((l) => ({
          consignmentItemId: l.consignmentItemId,
          enteredQty: l.enteredQty,
          enteredUnit: l.enteredUnit,
          price: l.linePrice,
          discountValue: l.discountValue,
          discountType: l.discountType,
          discountReason: l.discountReason,
        }));

      await processMergedSaleAction(listPayload, scalePayload, paymentMethod, buyerName, buyerPhone);

      setCart([]);
      setShowCart(false);
      setPaymentMethod(null);
      setBuyerName("");
      setBuyerPhone("");
      alert("Sale completed successfully!");
    } catch (error: any) {
      setCheckoutError(error.message || "Failed to process sale.");
    } finally {
      setLoading(false);
    }
  };

  const unitPair = drawerScaleItem ? unitsForBase(drawerScaleItem.baseUnit) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-app)]/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/staff/dashboard" className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
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
            className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0"
          >
            <ShoppingCart size={16} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center z-10">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Catalog toggle — controls what's being BROWSED, not the cart */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setCatalog("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              catalog === "list" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}
          >
            <List size={13} /> Standard
          </button>
          <button
            onClick={() => setCatalog("scale")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              catalog === "scale" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}
          >
            <ScaleIcon size={13} /> Scale
          </button>
        </div>
      </div>

      {/* Catalog grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {catalog === "list"
          ? filteredListItems.map((item) => (
              <ListCard
                key={item.id}
                item={item}
                qty={qtyInCart(item.id)}
                onAdd={() => addListItem(item)}
                onRemove={() => removeListItem(item.id)}
              />
            ))
          : filteredScaleLines.map((item) => {
              const inCart = cart.find((l) => l.kind === "scale" && l.consignmentItemId === item.consignmentItemId) as
                | ScaleCartLine
                | undefined;
              return (
                <ScaleCard
                  key={item.consignmentItemId}
                  item={item}
                  inCart={inCart}
                  onTap={() => openScaleDrawer(item)}
                />
              );
            })}
      </div>

      {catalog === "list" && filteredListItems.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-10">No standard items found.</p>
      )}
      {catalog === "scale" && filteredScaleLines.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-10">Nothing signed out to you today.</p>
      )}

      {/* Scale weigh-out drawer */}
      {drawerScaleItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative w-full bg-[var(--bg-surface)] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{drawerScaleItem.name}</h3>
              <button onClick={closeDrawer} className="p-2 text-slate-500 hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              {drawerScaleItem.remaining}{drawerScaleItem.baseUnit} left · ₦{drawerScaleItem.price.toLocaleString()}/{drawerScaleItem.baseUnit}
            </p>

            <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden w-fit mb-2">
              {(["qty", "amount"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEntryMode(m)}
                  className={`px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    entryMode === m ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-500"
                  }`}
                >
                  {m === "qty" ? `By ${drawerScaleItem.baseUnit}` : "By ₦"}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder={entryMode === "amount" ? "₦ amount" : "Amount"}
                value={entryMode === "amount" ? amountInput : qtyInput}
                onChange={(e) => (entryMode === "amount" ? setAmountInput(e.target.value) : setQtyInput(e.target.value))}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              {unitPair && (
                <select
                  value={saleUnit}
                  onChange={(e) => setSaleUnit(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value={unitPair.base}>{unitPair.base}</option>
                  <option value={unitPair.sub}>{unitPair.sub}</option>
                </select>
              )}
            </div>

            {entryMode === "amount" && effectiveQtyInput != null && (
              <p className="text-[11px] text-emerald-400 font-semibold -mt-2 mb-3">
                ≈ Weigh out {effectiveQtyInput}{saleUnit}
              </p>
            )}

            {drawerError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 mb-3">
                <AlertCircle size={13} /> {drawerError}
              </div>
            )}

            {discountEnabled && (
              <div className="mb-4">
                <button
                  onClick={() => setShowDiscount((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    showDiscount ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Tag size={12} /> Apply discount
                </button>
                {showDiscount && (
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "percent" | "flat")}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm"
                      >
                        <option value="percent">%</option>
                        <option value="flat">₦ off</option>
                      </select>
                    </div>
                    <select
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm"
                    >
                      {DISCOUNT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              disabled={drawerScaleItem.remaining <= 0}
              onClick={handleAddScaleFromDrawer}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 text-white transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart size={17} />
              {baseQtyPreview != null ? `Add · ₦${previewLineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Add to Cart"}
            </button>
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
              <button onClick={() => setShowCart(false)} className="p-2 text-slate-500 hover:text-[var(--text-primary)]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {cart.map((line) => (
                <div
                  key={line.kind === "list" ? `list-${line.id}` : `scale-${line.consignmentItemId}`}
                  className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {line.image ? <img src={line.image} alt={line.name} className="h-full w-full object-cover" /> : <Package size={16} className="text-slate-400 dark:text-slate-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{line.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                          {line.kind === "list" ? "Standard" : "Scale"}
                        </span>
                        <p className="text-xs text-slate-500">
                          {line.kind === "list" ? `x${line.qty}` : `${line.enteredQty}${line.enteredUnit}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {line.kind === "list" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => removeListItem(line.id)} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-[var(--text-primary)]">{line.qty}</span>
                      <button
                        onClick={() => addListItem({ id: line.id, name: line.name, price: line.price, quantity: line.maxQty } as ListItem)}
                        disabled={line.qty >= line.maxQty}
                        className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 disabled:opacity-30"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => removeScaleLine(line.consignmentItemId)} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-rose-400 hover:text-rose-300 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}

                  <span className="text-sm font-bold text-[var(--text-primary)] shrink-0 w-20 text-right">
                    ₦{(line.kind === "list" ? line.price * line.qty : line.linePrice * line.baseQty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
              {cart.length === 0 && <p className="text-center text-sm text-slate-500 py-6">Cart is empty.</p>}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mb-5 flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-[var(--text-primary)]">₦{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

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
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${paymentMethod === "cash" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"}`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("transfer")}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${paymentMethod === "transfer" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"}`}
                >
                  🏦 Transfer
                </button>
              </div>
            </div>

            {checkoutError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 mb-4">
                <AlertCircle size={13} /> {checkoutError}
              </div>
            )}

            <button
              disabled={loading || !paymentMethod || cart.length === 0}
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

function ListCard({
  item,
  qty,
  onAdd,
  onRemove,
}: {
  item: ListItem;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const isOutOfStock = item.quantity <= 0;
  return (
    <div
      className={`relative bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all ${
        isOutOfStock ? "border-slate-200 dark:border-slate-800 opacity-50" : qty > 0 ? "border-blue-500/50 shadow-lg shadow-blue-500/10" : "border-slate-200 dark:border-slate-800"
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
        {!isOutOfStock && qty === 0 && (
          <button
            onClick={onAdd}
            className="absolute bottom-2 right-2 z-10 h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex items-center justify-center text-white shadow-lg"
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
      {qty > 0 && (
        <div className="flex items-center justify-center gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-3 py-2">
          <button onClick={onRemove} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[var(--text-primary)]">
            <Minus size={14} />
          </button>
          <span className="text-sm font-bold text-[var(--text-primary)] w-5 text-center">{qty}</span>
          <button onClick={onAdd} disabled={qty >= item.quantity} className="h-7 w-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center text-white">
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ScaleCard({
  item,
  inCart,
  onTap,
}: {
  item: ScaleLine;
  inCart?: ScaleCartLine;
  onTap: () => void;
}) {
  const isOutOfStock = item.remaining <= 0;
  return (
    <button
      onClick={onTap}
      disabled={isOutOfStock}
      className={`relative text-left bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all disabled:opacity-50 ${
        inCart ? "border-blue-500/50 shadow-lg shadow-blue-500/10" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="relative bg-slate-50 dark:bg-slate-950 aspect-square flex items-center justify-center overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            <ScaleIcon size={24} className="text-slate-500" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full">NONE LEFT TODAY</span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">{item.name}</p>
        <p className="text-xs text-slate-500">{item.remaining}{item.baseUnit} left</p>
        <p className="mt-auto text-sm font-bold text-blue-400">₦{item.price.toLocaleString()}/{item.baseUnit}</p>
      </div>
      {inCart && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-3 py-2 text-center">
          <span className="text-xs font-bold text-blue-400">{inCart.enteredQty}{inCart.enteredUnit} in cart</span>
        </div>
      )}
    </button>
  );
}