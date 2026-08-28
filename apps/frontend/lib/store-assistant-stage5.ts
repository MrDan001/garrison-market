import prisma from "@/lib/prisma";

export type Stage5Role = "owner" | "staff";

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(num(value));

function wantsRecommendation(question: string) {
  return /\b(what should i|what should we|what do i|what do we|recommend|recommendation|suggest|advice|next step|next steps|what next|what now|restock|re-stock|slow moving|slow-moving|dead stock|best action|should i|should we|how can i improve|how can we improve|improve sales|increase sales|reduce losses|who should i follow up|who should we follow up)\b/i.test(question);
}

/**
 * Stage 5 — deterministic, live-data recommendations.
 *
 * The database decides what is actually happening; the model only explains
 * and prioritizes these recommendations. Staff receive only recommendations
 * based on their own permitted activity plus general store-safe stock data.
 */
export async function buildStoreAssistantStage5(
  role: Stage5Role,
  ownerId: number,
  storeId: number,
  userId: number,
  question: string,
) {
  if (!wantsRecommendation(question)) return "";

  try {
    const from30 = new Date(Date.now() - 30 * 86_400_000);
    const from14 = new Date(Date.now() - 14 * 86_400_000);
    const previous14 = new Date(Date.now() - 28 * 86_400_000);

    const orderWhere: any = {
      ownerId,
      storeId,
      date: { gte: from30 },
      ...(role === "staff" ? { staffId: userId } : {}),
    };

    const [
      inventory,
      scaleInventory,
      orderItems,
      scaleOrderItems,
      recentOrders,
      previousOrders,
      debts,
      staff,
    ] = await Promise.all([
      prisma.inventory.findMany({
        where: { ownerId, OR: [{ storeId }, { storeId: null }] },
        select: { name: true, quantity: true, restockLevel: true, price: true, costPrice: true },
      }),
      prisma.scaleInventory.findMany({
        where: { ownerId, OR: [{ storeId }, { storeId: null }] },
        select: { name: true, quantity: true, unit: true, restockLevel: true, price: true, costPrice: true },
      }),
      prisma.orderItem.findMany({
        where: { order: orderWhere },
        select: { quantity: true, inventory: { select: { name: true } } },
        take: 5000,
      }),
      prisma.scaleOrderItem.findMany({
        where: { order: orderWhere },
        select: { quantity: true, quantityInBaseUnit: true, scaleInventory: { select: { name: true, unit: true } } },
        take: 5000,
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: { total: true, staffId: true, date: true },
        orderBy: { date: "desc" },
        take: 2500,
      }),
      prisma.order.findMany({
        where: {
          ownerId,
          storeId,
          date: { gte: previous14, lt: from14 },
          ...(role === "staff" ? { staffId: userId } : {}),
        },
        select: { total: true, staffId: true },
        take: 2500,
      }),
      role === "owner"
        ? prisma.debt.findMany({
            where: { ownerId, storeId },
            select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } },
          })
        : Promise.resolve([]),
      role === "owner"
        ? prisma.user.findMany({
            where: { staffStoreId: storeId, role: "staff" },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const sold = new Map<string, number>();
    for (const item of orderItems) {
      const name = item.inventory.name;
      sold.set(name, (sold.get(name) ?? 0) + num(item.quantity));
    }
    for (const item of scaleOrderItems) {
      const name = item.scaleInventory.name;
      sold.set(name, (sold.get(name) ?? 0) + num(item.quantityInBaseUnit ?? item.quantity));
    }

    const restock: string[] = [];
    const deadStock: string[] = [];
    const slowMoving: string[] = [];

    for (const item of inventory) {
      const qty = num(item.quantity);
      const sold30 = sold.get(item.name) ?? 0;
      if (item.restockLevel != null && qty <= num(item.restockLevel)) {
        restock.push(`${item.name} — ${qty} left; restock level ${num(item.restockLevel)}; sold ${sold30} unit(s) in 30d`);
      }
      if (qty > 0 && sold30 === 0) deadStock.push(`${item.name} — ${qty} in stock, 0 sold in 30d`);
      else if (qty > 0 && sold30 <= 2) slowMoving.push(`${item.name} — ${qty} in stock, ${sold30} sold in 30d`);
    }

    for (const item of scaleInventory) {
      const qty = num(item.quantity);
      const sold30 = sold.get(item.name) ?? 0;
      if (item.restockLevel != null && qty <= num(item.restockLevel)) {
        restock.push(`${item.name} — ${qty} ${item.unit} left; restock level ${num(item.restockLevel)} ${item.unit}; sold ${sold30} base-unit(s) in 30d`);
      }
      if (qty > 0 && sold30 === 0) deadStock.push(`${item.name} — ${qty} ${item.unit} in stock, 0 sold in 30d`);
      else if (qty > 0 && sold30 <= 2) slowMoving.push(`${item.name} — ${qty} ${item.unit} in stock, ${sold30} base-unit(s) sold in 30d`);
    }

    const sales30 = recentOrders.reduce((sum, order) => sum + num(order.total), 0);
    const salesPrevious14 = previousOrders.reduce((sum, order) => sum + num(order.total), 0);
    const current14Orders = recentOrders.filter((order) => order.date >= from14);
    const sales14 = current14Orders.reduce((sum, order) => sum + num(order.total), 0);
    const salesChange = salesPrevious14 === 0 ? null : ((sales14 - salesPrevious14) / Math.abs(salesPrevious14)) * 100;

    const recommendations: string[] = [];
    if (restock.length) {
      recommendations.push(`RESTOCK FIRST: ${restock.slice(0, 5).join(" | ")}`);
    }
    if (deadStock.length) {
      recommendations.push(`DEAD STOCK TO REVIEW: ${deadStock.slice(0, 5).join(" | ")}`);
    }
    if (slowMoving.length) {
      recommendations.push(`SLOW-MOVING STOCK TO REVIEW: ${slowMoving.slice(0, 5).join(" | ")}`);
    }
    if (salesChange !== null && salesChange < -10) {
      recommendations.push(`SALES WARNING: last 14 days are down ${Math.abs(salesChange).toFixed(1)}% versus the preceding 14 days; investigate the decline before making pricing changes.`);
    }

    if (role === "owner") {
      const debtorRows = (debts as Array<{ totalAmount: unknown; amountPaid: unknown; customer: { name: string } }>)
        .map((d) => ({ name: d.customer.name, owed: num(d.totalAmount) - num(d.amountPaid) }))
        .filter((d) => d.owed > 0)
        .sort((a, b) => b.owed - a.owed);
      if (debtorRows.length) {
        recommendations.push(`DEBTOR FOLLOW-UP: ${debtorRows.slice(0, 3).map((d) => `${d.name} owes ${money(d.owed)}`).join(" | ")}`);
      }

      const staffRanking = (staff as Array<{ id: number; fullName: string | null; email: string }>)
        .map((member) => {
          const memberOrders = recentOrders.filter((o) => o.staffId === member.id);
          return {
            name: member.fullName || member.email,
            sales: memberOrders.reduce((sum, o) => sum + num(o.total), 0),
            orders: memberOrders.length,
          };
        })
        .sort((a, b) => b.sales - a.sales);
      if (staffRanking[0]) {
        recommendations.push(`STAFF FOCUS: ${staffRanking[0].name} leads the last 30 days with ${money(staffRanking[0].sales)} across ${staffRanking[0].orders} order(s). Use the result as a performance signal, not proof of causation.`);
      }
    }

    if (!recommendations.length) {
      recommendations.push(`NO CRITICAL RECOMMENDATION: ${money(sales30)} recorded across the last 30 days; no stock or sales warning crossed the deterministic thresholds.`);
    }

    return [
      "STAGE 5 — ACTIONABLE BUSINESS RECOMMENDATIONS",
      "These recommendations are calculated from live database records. Treat them as decision support, not guesses.",
      `30D SALES: ${money(sales30)} across ${recentOrders.length} order(s).`,
      `CURRENT 14D SALES: ${money(sales14)}; PREVIOUS 14D SALES: ${money(salesPrevious14)}; CHANGE=${salesChange === null ? "not measurable" : `${salesChange.toFixed(1)}%`}.`,
      `RECOMMENDATIONS: ${recommendations.join(" || ")}`,
      "RECOMMENDATION RULE: Never claim a product should definitely be purchased, discounted, or discontinued. Explain the evidence and suggest the safest next action. Never invent demand, supplier lead time, cause, or profit where the database does not contain it.",
      role === "staff" ? "STAFF PRIVACY: Recommendations must not reveal owner finances, debtor balances, or another staff member's performance." : "OWNER ACCESS: Store-wide operational and financial recommendations are allowed for this authenticated active store only.",
    ].join("\n");
  } catch (error) {
    console.error("buildStoreAssistantStage5 failed:", error);
    return "STAGE 5 — ACTIONABLE BUSINESS RECOMMENDATIONS\nRecommendation data is temporarily unavailable. Do not invent recommendations from missing data.";
  }
}
