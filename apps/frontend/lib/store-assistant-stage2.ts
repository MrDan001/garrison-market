import prisma from "@/lib/prisma";
import { computeHealthForStore } from "@/lib/rush-shop-health.actions";

export type Stage2Role = "owner" | "staff";

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

const pct = (value: number) => `${value.toFixed(1)}%`;

function daysFromQuestion(question: string) {
  const q = question.toLowerCase();
  if (q.includes("today")) return 1;
  if (q.includes("yesterday")) return 2;
  if (q.includes("week")) return 7;
  if (q.includes("month")) return 30;
  if (q.includes("year")) return 365;
  return 14;
}

function since(days: number, offsetDays = 0) {
  return new Date(Date.now() - (days + offsetDays) * 86_400_000);
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Stage 2: deterministic business analysis derived from live database data.
 * The model receives these calculations as facts and recommendations inputs;
 * it is explicitly told not to manufacture metrics.
 */
export async function buildStoreAssistantStage2(
  role: Stage2Role,
  ownerId: number,
  storeId: number,
  userId: number,
  question: string,
) {
  const days = daysFromQuestion(question);
  const currentFrom = since(days);
  const previousFrom = since(days, days);

  const orderScope: any = { ownerId, storeId, date: { gte: currentFrom } };
  const previousOrderScope: any = { ownerId, storeId, date: { gte: previousFrom, lt: currentFrom } };
  if (role === "staff") {
    orderScope.staffId = userId;
    previousOrderScope.staffId = userId;
  }

  const [
    currentSales,
    previousSales,
    currentOrders,
    previousOrders,
    currentItems,
    currentScaleItems,
    inventory,
    scaleInventory,
    customers,
    expenses,
    debts,
    staff,
    health,
  ] = await Promise.all([
    prisma.order.aggregate({ where: orderScope, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: previousOrderScope, _sum: { total: true }, _count: true }),
    prisma.order.findMany({
      where: orderScope,
      orderBy: { date: "asc" },
      take: 2500,
      select: { total: true, date: true, paymentMethod: true, customerId: true, staffId: true },
    }),
    prisma.order.findMany({
      where: previousOrderScope,
      take: 2500,
      select: { total: true, customerId: true },
    }),
    prisma.orderItem.findMany({
      where: { order: orderScope },
      take: 5000,
      select: {
        quantity: true,
        priceAtTime: true,
        inventory: { select: { name: true, costPrice: true } },
      },
    }),
    prisma.scaleOrderItem.findMany({
      where: { order: orderScope },
      take: 5000,
      select: {
        quantity: true,
        quantityInBaseUnit: true,
        priceAtTime: true,
        unit: true,
        scaleInventory: { select: { name: true, costPrice: true } },
      },
    }),
    prisma.inventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      select: { name: true, quantity: true, price: true, costPrice: true, restockLevel: true },
    }),
    prisma.scaleInventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      select: { name: true, quantity: true, unit: true, price: true, costPrice: true, restockLevel: true },
    }),
    prisma.customer.findMany({
      where: { ownerId, storeId },
      select: { id: true, createdAt: true },
    }),
    role === "owner"
      ? prisma.expense.findMany({ where: { ownerId, storeId, createdAt: { gte: currentFrom } }, select: { amount: true } })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.debt.findMany({ where: { ownerId, storeId }, select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } } })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.user.findMany({ where: { staffStoreId: storeId, role: "staff" }, select: { id: true, fullName: true, email: true } })
      : Promise.resolve([]),
    computeHealthForStore(storeId, ownerId).catch(() => null),
  ]);

  const sales = num(currentSales._sum.total);
  const previous = num(previousSales._sum.total);
  const orderCount = currentSales._count;
  const previousOrderCount = previousSales._count;
  const salesChange = changePercent(sales, previous);
  const orderChange = changePercent(orderCount, previousOrderCount);
  const averageOrder = orderCount ? sales / orderCount : 0;
  const previousAverageOrder = previousOrderCount ? previous / previousOrderCount : 0;
  const averageOrderChange = changePercent(averageOrder, previousAverageOrder);

  let knownRevenue = 0;
  let knownCost = 0;
  const productRevenue = new Map<string, number>();
  const productUnits = new Map<string, number>();
  const productProfit = new Map<string, number>();

  for (const item of currentItems) {
    const quantity = num(item.quantity);
    const revenue = quantity * num(item.priceAtTime);
    knownRevenue += revenue;
    if (item.inventory.costPrice != null) knownCost += quantity * num(item.inventory.costPrice);
    const name = item.inventory.name;
    productRevenue.set(name, (productRevenue.get(name) ?? 0) + revenue);
    productUnits.set(name, (productUnits.get(name) ?? 0) + quantity);
    if (item.inventory.costPrice != null) {
      productProfit.set(name, (productProfit.get(name) ?? 0) + quantity * (num(item.priceAtTime) - num(item.inventory.costPrice)));
    }
  }

  for (const item of currentScaleItems) {
    const quantity = num(item.quantityInBaseUnit ?? item.quantity);
    const revenue = quantity * num(item.priceAtTime);
    knownRevenue += revenue;
    if (item.scaleInventory.costPrice != null) knownCost += quantity * num(item.scaleInventory.costPrice);
    const name = item.scaleInventory.name;
    productRevenue.set(name, (productRevenue.get(name) ?? 0) + revenue);
    productUnits.set(name, (productUnits.get(name) ?? 0) + quantity);
    if (item.scaleInventory.costPrice != null) {
      productProfit.set(name, (productProfit.get(name) ?? 0) + quantity * (num(item.priceAtTime) - num(item.scaleInventory.costPrice)));
    }
  }

  const grossProfit = knownRevenue - knownCost;
  const grossMargin = knownRevenue > 0 ? (grossProfit / knownRevenue) * 100 : null;
  const expenseTotal = (expenses as Array<{ amount: unknown }>).reduce((sum, item) => sum + num(item.amount), 0);
  const contributionAfterExpenses = grossProfit - expenseTotal;

  const topRevenueProducts = [...productRevenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topProfitProducts = [...productProfit.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const paymentMix = new Map<string, number>();
  for (const order of currentOrders) {
    const key = String(order.paymentMethod || "unknown");
    paymentMix.set(key, (paymentMix.get(key) ?? 0) + num(order.total));
  }

  const daySales = new Map<string, number>();
  const hourSales = new Map<number, number>();
  for (const order of currentOrders) {
    const day = order.date.toLocaleDateString("en-NG", { weekday: "long" });
    daySales.set(day, (daySales.get(day) ?? 0) + num(order.total));
    const hour = order.date.getHours();
    hourSales.set(hour, (hourSales.get(hour) ?? 0) + num(order.total));
  }
  const strongestDays = [...daySales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const strongestHours = [...hourSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const activeCustomerIds = new Set(currentOrders.map((order) => order.customerId).filter(Boolean));
  const previousCustomerIds = new Set(previousOrders.map((order) => order.customerId).filter(Boolean));
  const newCustomers = customers.filter((customer) => customer.createdAt >= currentFrom).length;
  const returningCustomers = [...activeCustomerIds].filter((id) => previousCustomerIds.has(id)).length;

  const lowStock = inventory.filter((item) => item.restockLevel != null && num(item.quantity) <= num(item.restockLevel));
  const scaleLowStock = scaleInventory.filter((item) => item.restockLevel != null && num(item.quantity) <= num(item.restockLevel));
  const stockAtCost = inventory.reduce((sum, item) => sum + num(item.quantity) * num(item.costPrice), 0)
    + scaleInventory.reduce((sum, item) => sum + num(item.quantity) * num(item.costPrice), 0);
  const stockAtRetail = inventory.reduce((sum, item) => sum + num(item.quantity) * num(item.price), 0)
    + scaleInventory.reduce((sum, item) => sum + num(item.quantity) * num(item.price), 0);

  const debtorRows = (debts as Array<{ totalAmount: unknown; amountPaid: unknown; customer: { name: string } }> )
    .map((debt) => ({ name: debt.customer.name, owed: num(debt.totalAmount) - num(debt.amountPaid) }))
    .filter((row) => row.owed > 0)
    .sort((a, b) => b.owed - a.owed);
  const totalDebt = debtorRows.reduce((sum, row) => sum + row.owed, 0);

  const staffAnalysis = role === "owner"
    ? (staff as Array<{ id: number; fullName: string | null; email: string }>).map((member) => {
        const memberOrders = currentOrders.filter((order) => order.staffId === member.id);
        const memberSales = memberOrders.reduce((sum, order) => sum + num(order.total), 0);
        return { name: member.fullName || member.email, sales: memberSales, orders: memberOrders.length };
      }).sort((a, b) => b.sales - a.sales)
    : [];

  const flags: string[] = [];
  if (salesChange !== null && salesChange < -10) flags.push(`sales are down ${pct(Math.abs(salesChange))} versus the previous comparable period`);
  if (salesChange !== null && salesChange > 10) flags.push(`sales are up ${pct(salesChange)} versus the previous comparable period`);
  if (grossMargin !== null && grossMargin < 15) flags.push(`known-cost gross margin is only ${pct(grossMargin)}`);
  if (lowStock.length + scaleLowStock.length > 0) flags.push(`${lowStock.length + scaleLowStock.length} item(s) are at or below their restock level`);
  if (debtorRows.length > 0) flags.push(`${debtorRows.length} debtor balance(s) remain outstanding`);
  if (expenseTotal > grossProfit && role === "owner") flags.push("recorded expenses exceed the gross profit calculated from known costs");
  if (newCustomers === 0 && orderCount > 0) flags.push("there are sales but no newly created customers in this period");

  const actions: string[] = [];
  if (topRevenueProducts[0]) actions.push(`protect availability of ${topRevenueProducts[0][0]}, the highest-revenue product in this period`);
  if (lowStock[0]) actions.push(`review replenishment for ${lowStock[0].name}`);
  if (debtorRows[0] && role === "owner") actions.push(`follow up the largest outstanding debtor balance (${debtorRows[0].name}: ${money(debtorRows[0].owed)})`);
  if (salesChange !== null && salesChange < -10) actions.push("compare the strongest sales days/hours with the weaker period and investigate the decline before changing prices");
  if (grossMargin !== null && grossMargin < 20) actions.push("review pricing and supplier costs on the products with the weakest known margins");
  if (!actions.length) actions.push("continue monitoring sales, stock and margin trends; no critical deterministic warning was detected from the available data");

  const lines = [
    "STAGE 2 — REAL BUSINESS ANALYSIS (DETERMINISTIC LIVE-DATA FACTS)",
    `ANALYSIS PERIOD: last ${days} day(s); comparison is the immediately preceding ${days} day(s)`,
    `CURRENT SALES: ${money(sales)} across ${orderCount} order(s)`,
    `PREVIOUS COMPARABLE SALES: ${money(previous)} across ${previousOrderCount} order(s)`,
    `SALES CHANGE: ${salesChange === null ? "not measurable because the comparison period has zero sales" : pct(salesChange)}`,
    `ORDER COUNT CHANGE: ${orderChange === null ? "not measurable because the comparison period has zero orders" : pct(orderChange)}`,
    `AVERAGE ORDER VALUE: ${money(averageOrder)} | previous ${money(previousAverageOrder)} | change ${averageOrderChange === null ? "not measurable" : pct(averageOrderChange)}`,
    `KNOWN-COST PRODUCT REVENUE: ${money(knownRevenue)}`,
    `KNOWN PRODUCT COST: ${money(knownCost)}`,
    `ESTIMATED GROSS PROFIT FROM KNOWN COSTS: ${money(grossProfit)}`,
    `ESTIMATED GROSS MARGIN FROM KNOWN COSTS: ${grossMargin === null ? "not measurable" : pct(grossMargin)}`,
    `RECORDED EXPENSES IN PERIOD: ${money(expenseTotal)}${role === "staff" ? " (owner-only total is intentionally not exposed to staff)" : ""}`,
    role === "owner" ? `ESTIMATED CONTRIBUTION AFTER RECORDED EXPENSES: ${money(contributionAfterExpenses)}` : "",
    `ACTIVE CUSTOMERS WITH ORDERS: ${activeCustomerIds.size}`,
    `NEW CUSTOMER RECORDS: ${newCustomers}`,
    `RETURNING CUSTOMERS ALSO ACTIVE IN PRIOR PERIOD: ${returningCustomers}`,
    `PAYMENT MIX BY SALES: ${[...paymentMix.entries()].sort((a, b) => b[1] - a[1]).map(([method, value]) => `${method}=${money(value)}`).join("; ") || "none"}`,
    `STRONGEST SALES DAYS: ${strongestDays.map(([day, value]) => `${day}=${money(value)}`).join("; ") || "none"}`,
    `STRONGEST SALES HOURS: ${strongestHours.map(([hour, value]) => `${String(hour).padStart(2, "0")}:00=${money(value)}`).join("; ") || "none"}`,
    `TOP PRODUCTS BY REVENUE: ${topRevenueProducts.map(([name, value], i) => `${i + 1}. ${name}=${money(value)} (${productUnits.get(name) ?? 0} unit(s))`).join("; ") || "none"}`,
    `TOP PRODUCTS BY ESTIMATED GROSS PROFIT: ${topProfitProducts.map(([name, value], i) => `${i + 1}. ${name}=${money(value)}`).join("; ") || "none"}`,
    `INVENTORY RETAIL VALUE: ${money(stockAtRetail)}`,
    `INVENTORY COST VALUE: ${money(stockAtCost)}`,
    `LOW-STOCK ITEMS: ${[...lowStock.map((item) => `${item.name} (${item.quantity} left)`), ...scaleLowStock.map((item) => `${item.name} (${item.quantity} ${item.unit} left)`)].slice(0, 30).join("; ") || "none"}`,
    `RUSH SHOP HEALTH: ${health ? `score=${health.score}|tier=${health.tier}|label=${health.tierLabel}|stock=${health.breakdown.stockHealth}|sales=${health.breakdown.salesTrend}|staff=${health.breakdown.staffActivity}` : "unavailable"}`,
    role === "owner" ? `TOTAL OUTSTANDING DEBT: ${money(totalDebt)} across ${debtorRows.length} debtor(s)` : "",
    role === "owner" ? `LARGEST DEBTORS: ${debtorRows.slice(0, 5).map((row) => `${row.name}=${money(row.owed)}`).join("; ") || "none"}` : "",
    role === "owner" ? `STAFF SALES RANKING: ${staffAnalysis.map((member, i) => `${i + 1}. ${member.name}=${money(member.sales)} (${member.orders} order(s))`).join("; ") || "none"}` : "",
    `BUSINESS SIGNALS: ${flags.join("; ") || "no major deterministic warning detected"}`,
    `RECOMMENDED ACTIONS: ${actions.join("; ")}`,
    "ANALYSIS RULE: These are calculated from live records. The AI may explain, prioritize and contextualize them, but must not invent causes, missing values or unsupported financial conclusions.",
  ].filter(Boolean);

  return lines.join("\n");
}
