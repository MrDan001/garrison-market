import prisma from "@/lib/prisma";
import { computeHealthForStore } from "@/lib/rush-shop-health.actions";

export type AssistantRole = "owner" | "staff";

const n = (value: unknown) => {
  const valueAsNumber = Number(value ?? 0);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n(value));

const dateOnly = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : "—";

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
  if (days === 2) return "yesterday / last 2 days";
  if (days === 7) return "this week";
  if (days === 30) return "this month";
  if (days === 365) return "this year";
  return `the last ${days} days`;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

/**
 * Single source of truth for Ask Me's live business intelligence.
 *
 * Security rule:
 * - Every business query is scoped to the authenticated owner + active store.
 * - Owner context may include store-wide financial/staff information.
 * - Staff context is restricted to the current staff member for personal
 *   sales, attendance, Rush profile and activity. It never includes another
 *   staff member's private data, debtor balances, expenses or owner finances.
 * - Secrets (passwords, payment credentials, session tokens, etc.) are never
 *   selected and therefore never enter the model context.
 */
export async function buildStoreAssistantIntelligence(
  role: AssistantRole,
  ownerId: number,
  storeId: number,
  userId: number,
  question: string,
) {
  const days = periodDays(question);
  const from = since(days);
  const last30 = since(30);

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
      productsSold: true,
      shiftStartTime: true,
    },
  });

  if (!store) throw new Error("Store not found for the authenticated account.");

  const owner =
    role === "owner"
      ? await prisma.user.findFirst({
          where: { id: ownerId, role: "owner" },
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            storeName: true,
            shopAddress: true,
            shopCity: true,
            shopState: true,
            productsSold: true,
          },
        })
      : null;

  const staff =
    role === "owner"
      ? await prisma.user.findMany({
          where: { staffStoreId: storeId, role: "staff" },
          orderBy: { fullName: "asc" },
          take: 100,
          select: { id: true, fullName: true, email: true, status: true },
        })
      : await prisma.user.findMany({
          where: { id: userId, staffStoreId: storeId, role: "staff" },
          take: 1,
          select: { id: true, fullName: true, email: true, status: true },
        });

  const staffIds = staff.map((item) => item.id);

  const orderWhere =
    role === "owner"
      ? { ownerId, storeId, date: { gte: from } }
      : { ownerId, storeId, staffId: userId, date: { gte: from } };

  const recentOrderWhere =
    role === "owner"
      ? { ownerId, storeId, date: { gte: last30 } }
      : { ownerId, storeId, staffId: userId, date: { gte: last30 } };

  const [
    sales,
    recentOrders,
    inventory,
    scaleInventory,
    customers,
    orderItems,
    scaleOrderItems,
    clockEvents,
    rushProfiles,
    health,
    reports,
    stockLosses,
    stockReturns,
    scaleStockLosses,
    scaleStockReturns,
    scaleWastage,
    debts,
    expenses,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: recentOrderWhere,
      orderBy: { date: "desc" },
      take: 600,
      select: {
        total: true,
        date: true,
        staffId: true,
        paymentMethod: true,
        customerId: true,
      },
    }),
    prisma.inventory.findMany({
      where: { ownerId, OR: [{ storeId }, { storeId: null }] },
      orderBy: { quantity: "asc" },
      take: 200,
      select: {
        id: true,
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
      take: 160,
      select: {
        id: true,
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
    prisma.customer.findMany({
      where: { ownerId, storeId },
      orderBy: { name: "asc" },
      take: 250,
      select: { id: true, name: true, phone: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          ownerId,
          storeId,
          date: { gte: last30 },
          ...(role === "staff" ? { staffId: userId } : {}),
        },
      },
      select: {
        quantity: true,
        priceAtTime: true,
        inventory: { select: { name: true, costPrice: true } },
      },
      take: 3000,
    }),
    prisma.scaleOrderItem.findMany({
      where: {
        order: {
          ownerId,
          storeId,
          date: { gte: last30 },
          ...(role === "staff" ? { staffId: userId } : {}),
        },
      },
      select: {
        quantity: true,
        unit: true,
        quantityInBaseUnit: true,
        priceAtTime: true,
        scaleInventory: { select: { name: true, costPrice: true } },
      },
      take: 3000,
    }),
    role === "owner"
      ? prisma.clockEvent.findMany({
          where: { storeId, clockDate: { gte: last30 } },
          orderBy: { clockDate: "desc" },
          take: 500,
          select: {
            userId: true,
            clockDate: true,
            clockInAt: true,
            clockOutAt: true,
            onTime: true,
          },
        })
      : prisma.clockEvent.findMany({
          where: { storeId, userId, clockDate: { gte: last30 } },
          orderBy: { clockDate: "desc" },
          take: 90,
          select: {
            userId: true,
            clockDate: true,
            clockInAt: true,
            clockOutAt: true,
            onTime: true,
          },
        }),
    role === "owner"
      ? prisma.rushProfile.findMany({
          where: { storeId, userId: { in: staffIds } },
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
            questProgress: {
              orderBy: { questDate: "desc" },
              take: 8,
              select: {
                type: true,
                questDate: true,
                progress: true,
                target: true,
                completed: true,
              },
            },
            rewardSpins: {
              orderBy: { spinDate: "desc" },
              take: 5,
              select: {
                spinDate: true,
                claimed: true,
                prizeLabel: true,
                prizeKind: true,
                requiresSettlement: true,
                settled: true,
              },
            },
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
            questProgress: {
              orderBy: { questDate: "desc" },
              take: 12,
              select: {
                type: true,
                questDate: true,
                progress: true,
                target: true,
                completed: true,
              },
            },
            rewardSpins: {
              orderBy: { spinDate: "desc" },
              take: 8,
              select: {
                spinDate: true,
                claimed: true,
                prizeLabel: true,
                prizeKind: true,
                requiresSettlement: true,
                settled: true,
              },
            },
          },
        }),
    computeHealthForStore(storeId, ownerId).catch(() => null),
    prisma.report.findMany({
      where: {
        ownerId,
        storeId,
        date: { gte: last30 },
        ...(role === "staff" ? { authorId: userId } : {}),
      },
      orderBy: { date: "desc" },
      take: 100,
      select: {
        date: true,
        status: true,
        totalSales: true,
        cashTotal: true,
        transferTotal: true,
        notes: true,
        ownerNote: role === "owner" ? true : false,
      },
    }),
    role === "owner"
      ? prisma.stockLoss.findMany({
          where: { ownerId, storeId, createdAt: { gte: last30 } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            quantity: true,
            reason: true,
            note: true,
            createdAt: true,
            inventory: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.stockReturn.findMany({
          where: { ownerId, storeId, createdAt: { gte: last30 } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            quantity: true,
            supplierName: true,
            reason: true,
            refundAmount: true,
            createdAt: true,
            inventory: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.scaleStockLoss.findMany({
          where: { ownerId, storeId, createdAt: { gte: last30 } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            quantity: true,
            reason: true,
            note: true,
            createdAt: true,
            scaleInventory: { select: { name: true, unit: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.scaleStockReturn.findMany({
          where: { ownerId, storeId, createdAt: { gte: last30 } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            quantity: true,
            supplierName: true,
            reason: true,
            refundAmount: true,
            createdAt: true,
            scaleInventory: { select: { name: true, unit: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.scaleWastage.findMany({
          where: { ownerId, storeId, createdAt: { gte: last30 } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            quantity: true,
            unit: true,
            reason: true,
            note: true,
            status: true,
            createdAt: true,
            staffId: true,
            scaleInventory: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.debt.findMany({
          where: { ownerId, storeId },
          orderBy: { id: "desc" },
          take: 300,
          select: {
            totalAmount: true,
            amountPaid: true,
            customer: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    role === "owner"
      ? prisma.expense.findMany({
          where: { ownerId, storeId, createdAt: { gte: from } },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { amount: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const standardTop = new Map<string, number>();
  for (const item of orderItems) {
    standardTop.set(item.inventory.name, (standardTop.get(item.inventory.name) ?? 0) + n(item.quantity));
  }

  const scaleTop = new Map<string, number>();
  for (const item of scaleOrderItems) {
    scaleTop.set(item.scaleInventory.name, (scaleTop.get(item.scaleInventory.name) ?? 0) + n(item.quantityInBaseUnit ?? item.quantity));
  }

  const topProducts = [...standardTop.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topScaleProducts = [...scaleTop.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const lowStock = inventory.filter(
    (item) => item.restockLevel != null && n(item.quantity) <= n(item.restockLevel),
  );
  const scaleLowStock = scaleInventory.filter(
    (item) => item.restockLevel != null && n(item.quantity) <= n(item.restockLevel),
  );
  const outOfStock = inventory.filter((item) => n(item.quantity) <= 0).map((item) => item.name);
  const scaleOutOfStock = scaleInventory.filter((item) => n(item.quantity) <= 0).map((item) => item.name);

  const debtSummary =
    role === "owner"
      ? debts
          .map((debt) => ({
            name: debt.customer.name,
            owed: n(debt.totalAmount) - n(debt.amountPaid),
          }))
          .filter((item) => item.owed > 0)
          .sort((a, b) => b.owed - a.owed)
      : [];

  const expenseTotal = expenses.reduce((sum, item) => sum + n(item.amount), 0);
  const sales30 = recentOrders.reduce((sum, item) => sum + n(item.total), 0);
  const gross30 = orderItems.reduce((sum, item) => {
    if (item.inventory.costPrice == null) return sum;
    return sum + n(item.quantity) * (n(item.priceAtTime) - n(item.inventory.costPrice));
  }, 0);

  const staffStats =
    role === "owner"
      ? staff.map((member) => {
          const memberOrders = recentOrders.filter((order) => order.staffId === member.id);
          const attendance = clockEvents.filter((event) => event.userId === member.id);
          return {
            id: member.id,
            name: member.fullName || member.email,
            status: member.status,
            sales30d: memberOrders.reduce((sum, order) => sum + n(order.total), 0),
            orders30d: memberOrders.length,
            attendance30d: attendance.length,
            onTime30d: attendance.filter((event) => event.onTime).length,
          };
        })
      : [];

  const rushRows: any[] = Array.isArray(rushProfiles)
    ? rushProfiles
    : rushProfiles
      ? [rushProfiles]
      : [];

  const rushForOwner = rushRows.map((profile) => {
    const member = staff.find((item) => item.id === profile.userId);
    return {
      name: member?.fullName || member?.email || `User ${profile.userId}`,
      level: profile.level,
      totalXp: profile.totalXp,
      xpIntoLevel: profile.xpIntoLevel,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      lastActiveDate: dateOnly(profile.lastActiveDate),
      badges: profile.badges,
      streakShieldActive: profile.streakShieldActive,
      quests: profile.questProgress,
      rewards: profile.rewardSpins,
    };
  });

  const lines: string[] = [
    "AUTHENTICATED GARRISON MARKET BUSINESS INTELLIGENCE",
    "Do not invent facts. The following is live database context for the authenticated account and active store.",
    `ACCESS ROLE: ${role}`,
    `STORE: ${store.name} | id=${store.id} | type=${store.storeType}`,
    `STORE LOCATION: ${[store.address, store.city, store.state].filter(Boolean).join(", ") || "not recorded"}`,
    `STORE PHONE: ${store.phoneNumber || "not recorded"}`,
    `PRODUCTS SOLD DESCRIPTION: ${store.productsSold || owner?.productsSold || "not recorded"}`,
    `SHIFT START: ${store.shiftStartTime}`,
    `PERIOD ASKED: ${periodLabel(days)}`,
    `SALES FOR REQUESTED PERIOD: ${money(sales._sum.total)} across ${sales._count} recorded order(s)`,
    `CUSTOMER COUNT: ${customers.length}`,
    `TOP STANDARD PRODUCTS (30d): ${topProducts.map(([name, qty], index) => `${index + 1}. ${name} — ${qty} unit(s)`).join("; ") || "none"}`,
    `TOP SCALE PRODUCTS (30d): ${topScaleProducts.map(([name, qty], index) => `${index + 1}. ${name} — ${qty} base-unit(s)`).join("; ") || "none"}`,
    `STANDARD INVENTORY COUNT: ${inventory.length}`,
    `STANDARD LOW STOCK: ${lowStock.slice(0, 40).map((item) => `${item.name} (${item.quantity} left; restock at ${item.restockLevel})`).join("; ") || "none"}`,
    `STANDARD OUT OF STOCK: ${outOfStock.slice(0, 40).join(", ") || "none"}`,
    `SCALE INVENTORY COUNT: ${scaleInventory.length}`,
    `SCALE LOW STOCK: ${scaleLowStock.slice(0, 40).map((item) => `${item.name} (${item.quantity} ${item.unit} left; restock at ${item.restockLevel} ${item.unit})`).join("; ") || "none"}`,
    `SCALE OUT OF STOCK: ${scaleOutOfStock.slice(0, 40).join(", ") || "none"}`,
    `STANDARD INVENTORY DETAIL: ${inventory.slice(0, 120).map((item) => `${item.name}|qty=${item.quantity}|price=${money(item.price)}|cost=${item.costPrice == null ? "—" : money(item.costPrice)}|restock=${item.restockLevel ?? "—"}|category=${item.category ?? "—"}|expiry=${dateOnly(item.expiryDate)}`).join(" || ") || "none"}`,
    `SCALE INVENTORY DETAIL: ${scaleInventory.slice(0, 100).map((item) => `${item.name}|qty=${item.quantity} ${item.unit}|price=${money(item.price)}|cost=${item.costPrice == null ? "—" : money(item.costPrice)}|restock=${item.restockLevel ?? "—"}|category=${item.category ?? "—"}|expiry=${dateOnly(item.expiryDate)}`).join(" || ") || "none"}`,
    `RUSH SHOP HEALTH: ${health ? `score=${health.score}|tier=${health.tier}|label=${health.tierLabel}|stock=${health.breakdown.stockHealth}|sales=${health.breakdown.salesTrend}|staff=${health.breakdown.staffActivity}` : "unavailable"}`,
    `RECENT REPORTS (30d): ${reports.map((report) => `${report.date.toISOString()}|status=${report.status}|sales=${money(report.totalSales)}|cash=${money(report.cashTotal)}|transfer=${money(report.transferTotal)}|notes=${report.notes || ""}${role === "owner" ? `|ownerNote=${report.ownerNote || ""}` : ""}`).join(" || ") || "none"}`,
  ];

  if (role === "owner") {
    lines.push(
      `OWNER: ${owner ? `${owner.fullName || "Unnamed owner"}|email=${owner.email}|phone=${owner.phoneNumber || "—"}|business=${owner.storeName || store.name}|address=${owner.shopAddress || store.address || "—"}` : "not found"}`,
    );
    lines.push(`STAFF COUNT: ${staff.length}`);
    lines.push(
      `STAFF PERFORMANCE (30d): ${staffStats.map((member) => `${member.name}|status=${member.status}|sales=${money(member.sales30d)}|orders=${member.orders30d}|attendance=${member.attendance30d}|onTime=${member.onTime30d}`).join(" || ") || "none"}`,
    );
    lines.push(
      `RUSH STAFF PROFILES: ${rushForOwner.map((member) => `${member.name}|level=${member.level}|xp=${member.totalXp}|xpIntoLevel=${member.xpIntoLevel}|streak=${member.currentStreak}|longest=${member.longestStreak}|lastActive=${member.lastActiveDate}|shield=${member.streakShieldActive}|badges=${safeJson(member.badges)}|quests=${safeJson(member.quests)}|rewards=${safeJson(member.rewards)}`).join(" || ") || "none"}`,
    );
    lines.push(`DEBTORS: ${debtSummary.slice(0, 60).map((item) => `${item.name}|owed=${money(item.owed)}`).join(" || ") || "no outstanding balances"}`);
    lines.push(`TOTAL DEBT OUTSTANDING: ${money(debtSummary.reduce((sum, item) => sum + item.owed, 0))}`);
    lines.push(`EXPENSES FOR ${periodLabel(days).toUpperCase()}: ${money(expenseTotal)} across ${expenses.length} record(s)`);
    lines.push(`30D REVENUE: ${money(sales30)}`);
    lines.push(`30D GROSS PROFIT FROM KNOWN PRODUCT COSTS: ${money(gross30)}`);
    lines.push(`STANDARD STOCK LOSSES (30d): ${stockLosses.map((item) => `${item.inventory.name}|qty=${item.quantity}|reason=${item.reason}|note=${item.note || "—"}`).join(" || ") || "none"}`);
    lines.push(`STANDARD STOCK RETURNS (30d): ${stockReturns.map((item) => `${item.inventory.name}|qty=${item.quantity}|supplier=${item.supplierName || "—"}|refund=${item.refundAmount == null ? "—" : money(item.refundAmount)}|reason=${item.reason || "—"}`).join(" || ") || "none"}`);
    lines.push(`SCALE STOCK LOSSES (30d): ${scaleStockLosses.map((item) => `${item.scaleInventory.name}|qty=${item.quantity} ${item.scaleInventory.unit}|reason=${item.reason}|note=${item.note || "—"}`).join(" || ") || "none"}`);
    lines.push(`SCALE STOCK RETURNS (30d): ${scaleStockReturns.map((item) => `${item.scaleInventory.name}|qty=${item.quantity} ${item.scaleInventory.unit}|supplier=${item.supplierName || "—"}|refund=${item.refundAmount == null ? "—" : money(item.refundAmount)}|reason=${item.reason || "—"}`).join(" || ") || "none"}`);
    lines.push(`SCALE WASTAGE (30d): ${scaleWastage.map((item) => `${item.scaleInventory.name}|qty=${item.quantity} ${item.unit}|staffId=${item.staffId}|status=${item.status}|reason=${item.reason}|note=${item.note || "—"}`).join(" || ") || "none"}`);
    lines.push(`RECENT SALES SAMPLE: ${recentOrders.slice(0, 100).map((order) => `${order.date.toISOString()}|${money(order.total)}|staff=${order.staffId ?? "owner/unknown"}|payment=${order.paymentMethod}|customerId=${order.customerId ?? "—"}`).join(" || ") || "none"}`);
  } else {
    const me = staff[0];
    const myOrders = recentOrders;
    const mySales = myOrders.reduce((sum, order) => sum + n(order.total), 0);
    const myClock = clockEvents.filter((event) => event.userId === userId);
    const myRush = rushRows[0];

    lines.push(`CURRENT STAFF: ${me ? `${me.fullName || me.email}|status=${me.status}` : `userId=${userId}`}`);
    lines.push(`MY SALES (30d): ${money(mySales)} across ${myOrders.length} order(s)`);
    lines.push(`MY ATTENDANCE (30d): ${myClock.length} clock event(s), ${myClock.filter((event) => event.onTime).length} on-time`);
    lines.push(`MY RUSH: ${myRush ? `level=${myRush.level}|xp=${myRush.totalXp}|xpIntoLevel=${myRush.xpIntoLevel}|currentStreak=${myRush.currentStreak}|longestStreak=${myRush.longestStreak}|lastActive=${dateOnly(myRush.lastActiveDate)}|shield=${myRush.streakShieldActive}|badges=${safeJson(myRush.badges)}|quests=${safeJson(myRush.questProgress)}|rewards=${safeJson(myRush.rewardSpins)}` : "No Rush profile found yet."}`);
    lines.push("PRIVACY: Do not reveal other staff names, sales, attendance, Rush profiles, debtor balances, expenses, owner finances, payment credentials or private owner information to this staff user.");
  }

  return lines.join("\n");
}

export function assistantSystemPrompt(role: AssistantRole, liveContext: string) {
  return [
    "You are Ask Me, the embedded business assistant for Garrison Market.",
    "Answer using the authenticated live business context below whenever the user asks about this store.",
    "Never invent numbers, people, sales, stock, debts, Rush status or business events. If the data is missing, say it is not recorded or unavailable.",
    "Use Nigerian Naira (₦) for money. Be concise but useful, and explain the reason behind trends when the data supports it.",
    "For staff-performance questions, compare only the staff data that the current role is authorized to see.",
    "For owner questions, you may use store-wide financials, debtors, expenses, staff performance and Rush staff information.",
    "For staff questions, do not expose another staff member's private data or owner-only financial information.",
    "Rush includes Shop Health, staff XP/levels, streaks, quests, badges, shields and reward spins. Treat these as live application data.",
    "When the user asks a how-to question rather than a data question, give practical Garrison Market steps and do not pretend that a database fact answers a procedural question.",
    "Do not expose passwords, API keys, session tokens, payment credentials or other secrets even if they somehow appear in context.",
    `CURRENT ROLE: ${role}`,
    "\nLIVE CONTEXT:\n" + liveContext,
  ].join("\n");
}
