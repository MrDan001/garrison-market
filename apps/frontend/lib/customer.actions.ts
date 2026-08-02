// FILE: apps/frontend/lib/customer.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { hasFeatureAccess } from "./subscription-guard";

// Deliberately NOT applied to resolveOrCreateCustomer below — that function
// is checkout plumbing called from every sale path (standard, scale,
// consignment) to link an Order/Debt to a customer identity, not the
// "Customer Profiles" feature itself. Gating it would silently break sales
// and debt-linking for Basic-plan owners, which is a much bigger regression
// than "the ranked Customers page is a paid feature" should ever cause.
const FEATURE_SELECT = { plan: true, subscriptionStatus: true, trialEndsAt: true, maxPackageEnabled: true, customerProfilesOverride: true } as const;

// ============================================================================
// Checkout autocomplete
// ============================================================================
// Called from the staff checkout screens (list, scale, merged) as the staff
// member types into the Customer Name / Phone Number fields. Scoped to
// whichever store is active for THIS staff member (their assigned store —
// see getActiveStoreId), so a suggestion can never leak a customer from a
// different one of the owner's shops.
export async function searchCustomersAction(query: string) {
  const session = await getSessionUser();
  if (!session) return [];

  const ownerScopeId = session.role === "owner" ? session.id : session.ownerId;
  if (!ownerScopeId) return [];
  const owner = await prisma.user.findUnique({ where: { id: ownerScopeId }, select: FEATURE_SELECT });
  if (!owner || !hasFeatureAccess(owner, "customerProfiles")) return [];

  const storeId = await getActiveStoreId();
  if (!storeId) return [];

  const q = query.trim();
  if (!q) return [];

  const customers = await prisma.customer.findMany({
    where: {
      storeId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, phone: true },
  });

  return customers;
}

// ============================================================================
// Internal — resolve staff-entered name/phone into a Customer row
// ============================================================================
// Called from inside each sale action (processSaleAction, the scale sale
// action, the merged sale action) right before the Order is created — never
// exposed to the client directly. Matches an existing customer by phone
// within this store, refreshes the name if it changed, or creates a fresh
// row. A blank phone (still a very normal "walk-in, didn't ask" checkout)
// resolves to null: the sale still records buyerName/buyerPhone as free
// text same as before, it just isn't linked to any customer profile, so it
// never contributes to the Customers page ranking.
//
// This ONLY writes the identity row (name/phone) — no total, no running
// balance, nothing derived lives here or gets touched here. See Customer's
// schema comment: the spend total is computed fresh, only when the owner
// opens the Customers page.
export async function resolveOrCreateCustomer(params: {
  ownerId: number;
  storeId: number | null;
  name?: string | null;
  phone?: string | null;
}): Promise<number | null> {
  const phone = params.phone?.trim();
  const name = params.name?.trim();
  if (!phone || !params.storeId) return null;

  const customer = await prisma.customer.upsert({
    where: { storeId_phone: { storeId: params.storeId, phone } },
    update: name ? { name } : {},
    create: {
      ownerId: params.ownerId,
      storeId: params.storeId,
      phone,
      name: name || "Customer",
    },
    select: { id: true },
  });

  return customer.id;
}

// ============================================================================
// Owner Customers page
// ============================================================================
// Ranks this store's customers by total ₦ spent, for a given year (and,
// optionally, a specific month within it). Scoped to the owner's currently
// active store — switching stores gives a completely separate list, same
// as inventory/orders/reports do elsewhere in the app.
//
// A customer only appears if they have at least one linked order in the
// selected period — there's no "0 spent" padding. Nothing here is stored;
// every number is computed fresh from the Order table on each request,
// which is what keeps this the ONLY place a customer's running total is
// ever calculated or shown (see Customer's schema comment).
export async function getCustomersForOwner(params: { year?: number; month?: number | null } = {}) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") {
    return { customers: [], years: [new Date().getFullYear()], year: new Date().getFullYear(), month: null };
  }

  const owner = await prisma.user.findUnique({ where: { id: session.id }, select: FEATURE_SELECT });
  if (!owner || !hasFeatureAccess(owner, "customerProfiles")) {
    return { customers: [], years: [new Date().getFullYear()], year: new Date().getFullYear(), month: null };
  }

  const storeId = await getActiveStoreId();
  if (!storeId) {
    return { customers: [], years: [new Date().getFullYear()], year: new Date().getFullYear(), month: null };
  }

  const now = new Date();
  const year = params.year ?? now.getFullYear();
  const month = params.month && params.month >= 1 && params.month <= 12 ? params.month : null;

  // Use explicit UTC dates so server timezone offsets don't chop off boundary records
  const startDate = month
    ? new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    : new Date(Date.UTC(year, 0, 1, 0, 0, 0));

  const endDate = month
    ? new Date(Date.UTC(year, month, 1, 0, 0, 0))
    : new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  const dateFilter = { gte: startDate, lt: endDate };

  const [customers, totals, earliest] = await Promise.all([
    prisma.customer.findMany({
      where: { storeId },
      select: { id: true, name: true, phone: true },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { storeId, customerId: { not: null }, date: dateFilter },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // Drives the year picker's floor — the year picker "begins from
    // January" of whichever year this store's first-ever linked customer
    // shows up, not some arbitrary fixed date.
    prisma.customer.findFirst({
      where: { storeId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const totalsByCustomerId = new Map(totals.map((t) => [t.customerId as number, t]));

  const ranked = customers
    .map((c) => {
      const t = totalsByCustomerId.get(c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalSpent: Number(t?._sum.total ?? 0),
        orderCount: t?._count._all ?? 0,
      };
    })
    .filter((c) => c.orderCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const startYear = earliest?.createdAt.getFullYear() ?? now.getFullYear();
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= startYear; y--) years.push(y);
  if (years.length === 0) years.push(now.getFullYear());

  return { customers: ranked, years, year, month };
}