// FILE: apps/frontend/lib/pricing.helpers.ts
//
// SECURITY: this is the single source of truth for turning a cart line's
// discount input into a final sale price. It exists because every checkout
// path used to trust `item.price` straight from the client request body —
// a staff member (or anyone able to call the server action directly, which
// is trivial for a "use server" export) could set that to anything, record
// a sale at a fraudulent price while collecting full cash from the
// customer, and nothing server-side ever caught it. Stock decremented
// correctly so the shelves looked fine; only the money was wrong.
//
// The fix: every checkout function must look up the item's real price from
// the database (Inventory.price / ScaleInventory.price) and pass it here.
// The client may still *suggest* a discount (value + type + reason, for
// staff who are allowed to negotiate), but the base price and the discount
// math are always resolved server-side. `item.price` from the request body
// should never be written to `priceAtTime` directly again.

export type DiscountType = "percent" | "flat";

export interface DiscountInput {
  discountValue?: number | string | null;
  discountType?: DiscountType | string | null;
  discountReason?: string | null;
}

export interface ResolvedLinePrice {
  /** The final per-unit price to record on the order/consignment line. */
  price: number;
  /** The undiscounted catalog price, for receipts/reporting. */
  originalPrice: number;
  /** Only present if a valid, non-zero discount was actually applied. */
  discountValue?: number;
  discountType?: DiscountType;
  discountReason?: string;
}

/**
 * Mirrors the client's `computeDiscountedPrice()` exactly (percent clamped
 * to 0-100, flat clamped so price never goes below 0) so behavior matches
 * what staff see in the UI — but runs here, server-side, against a
 * database-sourced base price, so the result can't be spoofed.
 *
 * @param basePrice        Authoritative price from Inventory/ScaleInventory.
 * @param discountsAllowed Owner's current `discountEnabled` setting. If
 *                         false, any discount fields are ignored entirely
 *                         and the full base price is returned.
 * @param input             Raw discount fields as received from the client.
 */
export function resolveLinePrice(
  basePrice: number,
  discountsAllowed: boolean,
  input: DiscountInput
): ResolvedLinePrice {
  const base = Number(basePrice);

  if (!discountsAllowed) {
    return { price: base, originalPrice: base };
  }

  const rawValue = Number(input.discountValue);
  const rawType = input.discountType;

  if (
    !Number.isFinite(rawValue) ||
    rawValue <= 0 ||
    (rawType !== "percent" && rawType !== "flat")
  ) {
    return { price: base, originalPrice: base };
  }

  const finalPrice =
    rawType === "percent"
      ? Math.max(0, base - (base * Math.min(rawValue, 100)) / 100)
      : Math.max(0, base - rawValue);

  return {
    price: finalPrice,
    originalPrice: base,
    discountValue: rawType === "percent" ? Math.min(rawValue, 100) : Math.min(rawValue, base),
    discountType: rawType,
    ...(input.discountReason ? { discountReason: String(input.discountReason).slice(0, 300) } : {}),
  };
}

/**
 * Scale-item variant of resolveLinePrice.
 *
 * The three scale-based checkout screens (single-store scale sales,
 * consignment scale sales, and the scale side of the merged cart) all
 * define a "flat" discount differently than the piece-inventory screen
 * does: flat means a naira amount off the *whole line*, which the UI then
 * spreads across the quantity to get a per-unit reduction —
 * `basePrice - (flatValue / baseQty)` — rather than a flat amount off the
 * per-unit price directly. ("Take ₦500 off this sale" makes sense for a
 * scale item; "₦500 off per kilogram" doesn't, since the per-kg price and
 * the quantity sold can vary wildly.) Percent discounts work the same way
 * as the piece-inventory path in both cases.
 *
 * This must match the client's `computeDiscountedUnitPrice()` exactly, or
 * the price a customer is shown at the register won't match what actually
 * gets recorded.
 */
export function resolveScaleLinePrice(
  basePrice: number,
  baseQty: number,
  discountsAllowed: boolean,
  input: DiscountInput
): ResolvedLinePrice {
  const base = Number(basePrice);

  if (!discountsAllowed) {
    return { price: base, originalPrice: base };
  }

  const rawValue = Number(input.discountValue);
  const rawType = input.discountType;

  if (
    !Number.isFinite(rawValue) ||
    rawValue <= 0 ||
    (rawType !== "percent" && rawType !== "flat") ||
    !Number.isFinite(baseQty) ||
    baseQty <= 0
  ) {
    return { price: base, originalPrice: base };
  }

  const finalPrice =
    rawType === "percent"
      ? Math.max(0, base - (base * Math.min(rawValue, 100)) / 100)
      : Math.max(0, base - rawValue / baseQty);

  return {
    price: finalPrice,
    originalPrice: base,
    // Percent is still capped at 100; flat is capped so the naira amount
    // can never claim to discount more than the full line is worth.
    discountValue: rawType === "percent" ? Math.min(rawValue, 100) : Math.min(rawValue, base * baseQty),
    discountType: rawType,
    ...(input.discountReason ? { discountReason: String(input.discountReason).slice(0, 300) } : {}),
  };
}

/** Validates a cart-line quantity is a positive, finite integer. Rejects
 * zero, negative numbers, decimals, NaN, and non-numeric input — all of
 * which were previously able to slip through and, for negative values,
 * turn a "sale" into a silent stock top-up (decrement by a negative number
 * increases quantity). */
export function isValidPositiveQty(qty: unknown): qty is number {
  return typeof qty === "number" && Number.isFinite(qty) && Number.isInteger(qty) && qty > 0;
}