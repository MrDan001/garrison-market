import prisma from "@/lib/prisma";
import { computeHealthForStore } from "@/lib/rush-shop-health.actions";

export type AssistantRole = "owner" | "staff";

const moneyNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (value: unknown) => {
  const n = moneyNumber(value);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
};

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function periodDays(question: string) {
  const q = question.toLowerCase();
  if (q.includes("today")) return 1;
  if (q.includes("yesterday")) return 2;
  if (q.includes("week")) return 7;
  if (q.includes("month")) return 30;
  if (q.includes("year")) return 365;
  return 14;
}

function periodLabel(days: number) {
  if (days === 1) return "today";
  if (days === 7) return "this week";
  if (days === 30) return "this month";
  if (days === 365) return "this year";
  return `the last ${days} days`;
}

export async function buildStoreAssistantContext(
  role: AssistantRole,
  ownerId: number,
  storeId: number,
  userId: number,
  question: string,
) {
  const days = periodDays(question);
  const from = since(days);
  const recentFrom = since(30);

  const store = await prisma.store.findFirst({
    where: { id: storeId, ownerId },
    select: {
      id: true,
      name: true,
      storeType: true,
      phoneNumber: true,
      address: true,
      city: true,
      state: true,
      shiftStartTime: true,
    },
  });

  if (!store) throw new Error("Store not found for the authenticated account.");

  const [
    salesAgg,
    recentOrders,
    inventory,
    scaleInventory,
    customerCount,
    activeStaff,
    rushProfiles,
    clockEvents,
    debts,
    expenses,
    health,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { ownerId, storeId, date: { gte: from } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { ownerId, storeId, date: { gte: recentFrom } },
      orderBy: { date: "desc" },
      take: 600,
      select: { total: true, date: true, staffId: true, paymentMethod: true },
    }),
    prisma.inventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      orderBy: { quantity: "asc" },
      take: 160,
      select: {
        name: true,
        quantity: true,
        price: true,
        costPrice: true,
        restockLevel: true,
        category: true,
        expiryDate: true,
      },
    }),
    prisma.scaleInventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      orderBy: { quantity: "asc" },
      take: 120,
      select: {
        name: true,
        quantity: true,
        unit: true,
        price: true,
        costPrice: true,
        restockLevel: true,
        category: true,
        expiryDate: true,
      },
    }),
    prisma.customer.count({ where: { ownerId, storeId } }),
    role === "owner"
      ? prisma.user.findMany({
          where: { staffStoreId: storeId, role: "staff", status: "active" },
          orderBy: { fullName: "asc" },
          take: 100,
          select: { id: true, fullName: true, email: true, phoneNumber: true, status: true, createdAt: true },
        })
      : prisma.user.findMany({
          where: { id: userId, staffStoreId: storeId, role: "staff" },
          take: 1,
          select: { id: true, fullName: true, email: true, phoneNumber: true, status: true, createdAt: true },
        }),
    role === "owner"
      ? prisma.rushProfile.findMany({
          where: { storeId, userId: { in: (await prisma.user.findMany({ where: { staffStoreId: storeId, role: "staff" }, select: { id: true }, take: 100 })).map((u) => u.id) } },
          select: {
            userId: true,
            level: true,
            totalXp: true,
            xpIntoLevel: true,
            currentStreak: true,
            longestStreak: true,
            lastActiveDate: true,
            badges: true,
            streakShieldActive: true,
            questProgress: { orderBy: { questDate: "desc" }, take: 8, select: { type: true, questDate: true, progress: true, target: true, completed: true } },
            rewardSpins: { orderBy: { spinDate: "desc" }, take: 5, select: { spinDate: true, claimed: true, prizeLabel: true, prizeKind: true, requiresSettlement: true, settled: true } },
          },
        })
      : prisma.rushProfile.findFirst({
          where: { storeId, userId },
          select: {
            userId: true,
            level: true,
            totalXp: true,
            xpIntoLevel: true,
            currentStreak: true,
            longestStreak: true,
            lastActiveDate: true,
            badges: true,
            streakShieldActive: true,
            questProgress: { orderBy: { questDate: "desc" }, take: 12, select: { type: true, questDate: true, progress: true, target: true, completed: true } },
            rewardSpins: { orderBy: { spinDate: "desc" }, take: 8, select: { spinDate: true, claimed: true, prizeLabel: true, prizeKind: true, requiresSettlement: true, settled: true } },
          },
        }),
    role === "owner"
      ? prisma.clockEvent.findMany({ where: { storeId, clockDate: { gte: recentFrom } }, orderBy: { clockDate: "desc" }, take: 300, select: { userId: true, clockDate: true, clockInAt: true, clockOutAt: true, onTime: true } })
      : prisma.clockEvent.findMany({ where: { storeId, userId, clockDate: { gte: recentFrom } }, orderBy: { clockDate: "desc" }, take: 60, select: { userId: true, clockDate: true, clockInAt: true, clockOutAt: true, onTime: true } }),
    role === "owner"
      ? prisma.debt.findMany({ where: { ownerId, storeId }, take: 200, select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } } })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.expense.findMany({ where: { ownerId, storeId, createdAt: { gte: from } }, orderBy: { createdAt: "desc" }, take: 120, select: { amount: true, category: true, description: true, createdAt: true } })
      : Promise.resolve([]),
    computeHealthForStore(storeId, ownerId).catch(() => null),
  ]);

  const staffList = activeStaff;
  const staffIds = new Set(staffList.map((staff) => staff.id));
  const staffStats = staffList.map((staff) => {
    const staffOrders = recentOrders.filter((order) => order.staffId === staff.id);
    const staffSales = staffOrders.reduce((sum, order) => sum + moneyNumber(order.total), 0);
    const attendance = clockEvents.filter((event) => event.userId === staff.id);
    return {
      id: staff.id,
      name: staff.fullName || staff.email,
      status: staff.status,
      sales30d: staffSales,
      orders30d: staffOrders.length,
      attendance30d: attendance.length,
      onTime30d: attendance.filter((event) => event.onTime).length,
    };
  });

  const staffRush = Array.isArray(rushProfiles)
    ? rushProfiles.map((profile: any) => {
        const staff = staffList.find((item) => item.id === profile.userId);
        return {
          name: staff?.fullName || staff?.email || `User ${profile.userId}`,
          level: profile.level,
          totalXp: profile.totalXp,
          xpIntoLevel: profile.xpIntoLevel,
          currentStreak: profile.currentStreak,
          longestStreak: profile.longestStreak,
          lastActiveDate: profile.lastActiveDate,
          badges: profile.badges,
          streakShieldActive: profile.streakShieldActive,
          quests: profile.questProgress,
          rewards: profile.rewardSpins,
        };
      })
    : [];

  const lowStock = inventory.filter((item) => item.restockLevel != null && Number(item.quantity) <= Number(item.restockLevel));
  const scaleLowStock = scaleInventory.filter((item) => item.restockLevel != null && moneyNumber(item.quantity) <= moneyNumber(item.restockLevel));
  const outOfStock = inventory.filter((item) => Number(item.quantity) <= 0).map((item) => item.name);
  const scaleOutOfStock = scaleInventory.filter((item) => moneyNumber(item.quantity) <= 0).map((item) => item.name);

  const debtSummary = role === "owner"
    ? debts
        .map((debt) => ({ name: debt.customer.name, owed: moneyNumber(debt.totalAmount) - moneyNumber(debt.amountPaid) }))
        .filter((item) => item.owed > 0)
        .sort((a, b) => b.owed - a.owed)
    : [];

  const expenseTotal = expenses.reduce((sum, expense) => sum + moneyNumber(expense.amount), 0);

  const lines = [
    "AUTHENTICATED BUSINESS CONTEXT",
    `STORE: ${store.name}`,
    `STORE TYPE: ${store.storeType}`,
    `LOCATION: ${[store.city, store.state].filter(Boolean).join(", ") || "Unknown"}`,
    `SHIFT START: ${store.shiftStartTime}`,
    `PERIOD ASKED: ${periodLabel(days)}`,
    `SALES: ${money(salesAgg._sum.total)} across ${salesAgg._count} order(s)`,
    `CUSTOMERS: ${customerCount}`,
    `STANDARD INVENTORY: ${inventory.length} items`,
    `STANDARD LOW STOCK: ${lowStock.slice(0, 30).map((item) => `${item.name} (${item.quantity} left)`).join("; ") || "none"}`,
    `STANDARD OUT OF STOCK: ${outOfStock.slice(0, 30).join(", ") || "none"}`,
    `SCALE INVENTORY: ${scaleInventory.length} items`,
    `SCALE LOW STOCK: ${scaleLowStock.slice(0, 30).map((item) => `${item.name} (${item.quantity} ${item.unit} left)`).join("; ") || "none"}`,
    `SCALE OUT OF STOCK: ${scaleOutOfStock.slice(0, 30).join(", ") || "none"}`,
    `INVENTORY DETAIL: ${inventory.slice(0, 100).map((item) => `${item.name}|qty=${item.quantity}|price=${money(item.price)}|cost=${item.costPrice == null ? "—" : money(item.costPrice)}|restock=${item.restockLevel ?? "—"}|category=${item.category ?? "—"}|expiry=${item.expiryDate?.toISOString() ?? "—"}`).join(" || ") || "none"}`,
    `SCALE INVENTORY DETAIL: ${scaleInventory.slice(0, 80).map((item) => `${item.name}|qty=${item.quantity} ${item.unit}|price=${money(item.price)}|cost=${item.costPrice == null ? "—" : money(item.costPrice)}|restock=${item.restockLevel ?? "—"}|category=${item.category ?? "—"}|expiry=${item.expiryDate?.toISOString() ?? "—"}`).join(" || ") || "none"}`,
  ];

  if (role === "owner") {
    const revenue30d = recentOrders.reduce((sum, order) => sum + moneyNumber(order.total), 0);
    let gross30d = 0;
    const recentOrderIds = recentOrders.map((order) => order);
    if (recentOrderIds.length) {
      const items = await prisma.orderItem.findMany({
        where: { order: { ownerId, storeId, date: { gte: recentFrom } } },
        select: { quantity: true, priceAtTime: true, inventory: { select: { costPrice: true } } },
        take: 2000,
      });
      gross30d = items.reduce((sum, item) => item.inventory.costPrice == null ? sum : sum + moneyNumber(item.quantity) * (moneyNumber(item.priceAtTime) - moneyNumber(item.inventory.costPrice)), 0);
    }
    lines.push(`OWNER STAFF COUNT: ${staffList.length}`);
    lines.push(`STAFF PERFORMANCE (30d): ${staffStats.map((staff) => `${staff.name}|sales=${money(staff.sales30d)}|orders=${staff.orders30d}|attendance=${staff.attendance30d}|onTime=${staff.onTime30d}`).join(" || ") || "none"}`);
    lines.push(`RUSH STAFF PROFILES: ${staffRush.map((staff) => `${staff.name}|level=${staff.level}|xp=${staff.totalXp}|streak=${staff.currentStreak}|longest=${staff.longestStreak}|shield=${staff.streakShieldActive}|quests=${JSON.stringify(staff.quests)}|rewards=${JSON.stringify(staff.rewards)}`).join(" || ") || "none"}`);
    lines.push(`RUSH SHOP HEALTH: ${health ? `score=${health.score}|tier=${health.tier}|label=${health.tierLabel}|stock=${health.breakdown.stockHealth}|sales=${health.breakdown.salesTrend}|staff=${health.breakdown.staffActivity}` : "unavailable"}`);
    lines.push(`DEBTORS: ${debtSummary.slice(0, 40).map((item) => `${item.name}|owed=${money(item.owed)}`).join(" || ") || "no outstanding balances"}`);
    lines.push(`DEBT TOTAL OUTSTANDING: ${money(debtSummary.reduce((sum, item) => sum + item.owed, 0))}`);
    lines.push(`EXPENSES FOR ${periodLabel(days).toUpperCase()}: ${money(expenseTotal)} across ${expenses.length} record(s)`);
    lines.push(`RECENT EXPENSE DETAIL: ${expenses.slice(0, 40).map((expense) => `${expense.category ?? "Uncategorised"}|${money(expense.amount)}|${expense.description ?? ""}`).join(" || ") || "none"}`);
    lines.push(`RECENT SALES SAMPLE: ${recentOrders.slice(0, 80).map((order) => `${order.date.toISOString()}|${money(order.total)}|staff=${order.staffId ?? "owner/unknown"}|payment=${order.paymentMethod}`).join(" || ") || "none"}`);
    lines.push(`30D REVENUE: ${money(revenue30d)} | 30D RECORDED GROSS PROFIT FROM KNOWN COSTS: ${money(gross30d)}`);
  } else {
    const me = staffList[0];
    const myOrders = recentOrders.filter((order) => order.staffId === userId);
    const mySales = myOrders.reduce((sum, order) => sum + moneyNumber(order.total), 0);
    const myClock = clockEvents.filter((event) => event.userId === userId);
    const myRush: any = Array.isArray(rushProfiles) ? rushProfiles[0] : rushProfiles;
    lines.push(`CURRENT STAFF: ${me ? `${me.fullName || me.email}|status=${me.status}` : `userId=${userId}`}`);
    lines.push(`MY SALES (30d): ${money(mySales)} across ${myOrders.length} order(s)`);
    lines.push(`MY ATTENDANCE (30d): ${myClock.length} clock event(s), ${myClock.filter((event) => event.onTime).length} on-time`);
    lines.push(`MY RUSH: ${myRush ? `level=${myRush.level}|xp=${myRush.totalXp}|xpIntoLevel=${myRush.xpIntoLevel}|currentStreak=${myRush.currentStreak}|longestStreak=${myRush.longestStreak}|lastActive=${myRush.lastActiveDate?.toISOString() ?? "—"}|shield=${myRush.streakShieldActive}|badges=${JSON.stringify(myRush.badges)}|quests=${JSON.stringify(myRush.questProgress)}|rewards=${JSON.stringify(myRush.rewardSpins)}` : "No Rush profile found yet."}`);
    lines.push("STAFF PRIVACY: This assistant may discuss the current staff member's own operational performance, attendance and Rush information, plus store operational information. It must not reveal owner-only financials, debtor balances, private expenses, payroll, supplier/private owner data, or another staff member's private performance/Rush data.");
  }

  return lines.join("\n");
}

export function assistantSystemPrompt(role: AssistantRole, liveContext: string) {
  return [
    role === "owner"
      ? "You are Ask Me, the private business intelligence assistant for the authenticated Garrison Market owner."
      : "You are Ask Me, the operational assistant for the authenticated Garrison Market staff member.",
    "The server has supplied verified live data for exactly one authenticated store. Treat that data as the source of truth for business facts.",
    "Never invent numbers, products, staff, customers, transactions, Rush progress, rewards, financial results or causes that are not supported by the supplied context.",
    "Never mix data between stores.",
    role === "owner"
      ? "The owner may receive the private financial, debtor, expense, staff-performance and Rush information included in the context. Do not expose secrets such as passwords, session tokens or API keys."
      : "Staff may receive their own operational/Rush information and general store operations. Never reveal owner-only financials, debtor balances, private expenses, payroll, supplier/private owner data, or another staff member's private performance or Rush data.",
    "If asked why something happened, distinguish a measured fact from a possible explanation. Do not claim causation unless the data proves it.",
    "Answer the user's actual question directly. If live data is insufficient, say exactly what is missing.",
    "Keep the answer concise, practical and business-focused.",
    "",
    "LIVE VERIFIED BUSINESS CONTEXT:",
    liveContext,
  ].join("\n");
}
