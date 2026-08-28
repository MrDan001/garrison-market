import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import prisma from "@/lib/prisma";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";
const MAX_HISTORY = 10;
const MAX_CHARS = 2400;
const MAX_CONTEXT = 26000;
const MAX_IMAGE_CHARS = 3_500_000;

type Role = "owner" | "staff";
type ChatMessage = { role: "user" | "assistant"; content: string };

const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n)
    : "₦0";
};

function periodDays(question: string) {
  const q = question.toLowerCase();
  if (q.includes("today")) return 1;
  if (q.includes("yesterday")) return 2;
  if (q.includes("week")) return 7;
  if (q.includes("month")) return 30;
  if (q.includes("year")) return 365;
  return 14;
}

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function periodLabel(days: number) {
  if (days === 1) return "today";
  if (days === 7) return "this week";
  if (days === 30) return "this month";
  return `the last ${days} days`;
}

function isGreeting(q: string) {
  return /^(hi|hello|hey|helo|helli|good morning|good afternoon|good evening|how are you)[!?. ]*$/i.test(q.trim());
}

function restrictedForStaff(q: string) {
  return /profit|margin|net profit|gross profit|expense|expenses|spent|spending|debt|debtor|owe|owes|credit|part[- ]?payment|wastage|waste|stock loss|refund|supplier|salary|payroll|best staff|staff ranking|other staff|other store/i.test(q);
}

async function sales(ownerId: number, storeId: number, days: number, staffId?: number) {
  const where: any = { ownerId, storeId, date: { gte: since(days) } };
  if (staffId) where.staffId = staffId;
  return prisma.order.aggregate({ where, _sum: { total: true }, _count: true });
}

async function profit(ownerId: number, storeId: number, days: number) {
  const orders = await prisma.order.findMany({
    where: { ownerId, storeId, date: { gte: since(days) } },
    select: {
      total: true,
      items: {
        select: {
          quantity: true,
          priceAtTime: true,
          inventory: { select: { costPrice: true } },
        },
      },
    },
  });

  let revenue = 0;
  let gross = 0;
  for (const order of orders) {
    revenue += Number(order.total);
    for (const item of order.items) {
      if (item.inventory.costPrice != null) {
        gross += Number(item.quantity) * (Number(item.priceAtTime) - Number(item.inventory.costPrice));
      }
    }
  }

  const expenses = await prisma.expense.aggregate({
    where: { ownerId, storeId, createdAt: { gte: since(days) } },
    _sum: { amount: true },
  });

  const expenseTotal = Number(expenses._sum.amount ?? 0);
  return { revenue, gross, expenses: expenseTotal, net: gross - expenseTotal, orders: orders.length };
}

async function directAnswer(role: Role, ownerId: number, storeId: number, staffId: number, question: string) {
  const q = question.toLowerCase().trim();
  const days = periodDays(q);

  if (isGreeting(q)) {
    return "Hello! I’m Ask Me, your Garrison Market assistant. I can answer questions about this store’s sales, stock, products and — for the owner — private business finances.";
  }

  if (restrictedForStaff(q) && role === "staff") {
    if (/profit|margin|net profit|gross profit/.test(q)) return "Profit and private financial results are restricted to the store owner.";
    if (/debt|debtor|owe|owes|credit|part[- ]?payment/.test(q)) return "Debtor balances and credit-sale information are restricted to the store owner.";
    if (/expense|expenses|spent|spending|salary|payroll|supplier|refund|wastage|waste/.test(q)) return "Private business expenses, supplier, payroll and loss information are restricted to the store owner.";
    return "That information is restricted to the store owner.";
  }

  if (/latest sale|last sale|most recent sale/.test(q)) {
    const where: any = { ownerId, storeId, date: { gte: since(days) } };
    if (role === "staff") where.staffId = staffId;
    const order = await prisma.order.findFirst({
      where,
      orderBy: { date: "desc" },
      select: { total: true, date: true, paymentMethod: true },
    });
    return order
      ? `The latest recorded sale in ${periodLabel(days)} was ${money(order.total)} via ${order.paymentMethod}.`
      : `There are no recorded sales in ${periodLabel(days)}.`;
  }

  if (/how much did we sell|total sales|sales total|how much was sold|sales so far|sales for/.test(q)) {
    const result = await sales(ownerId, storeId, days, role === "staff" ? staffId : undefined);
    return `For ${periodLabel(days)}, the live store data shows ${money(result._sum.total)} across ${result._count} recorded order(s).`;
  }

  if (/why (are|is|did).*sales|why sales|sales down|sales dropping|sales fallen/.test(q)) {
    const current = await sales(ownerId, storeId, 7, role === "staff" ? staffId : undefined);
    const previousWhere: any = {
      ownerId,
      storeId,
      date: { gte: since(14), lt: since(7) },
    };
    if (role === "staff") previousWhere.staffId = staffId;
    const previous = await prisma.order.aggregate({ where: previousWhere, _sum: { total: true }, _count: true });
    const now = Number(current._sum.total ?? 0);
    const old = Number(previous._sum.total ?? 0);
    if (!old) return `This week has ${money(now)} from ${current._count} order(s). There is no previous-week baseline yet, so the data cannot prove why sales changed.`;
    const pct = ((now - old) / old) * 100;
    return now < old
      ? `Sales are down ${Math.abs(pct).toFixed(1)}%: ${money(now)} this week versus ${money(old)} in the previous 7 days. The data confirms the decline, but it cannot by itself prove the cause.`
      : `Sales are not down: ${money(now)} this week versus ${money(old)} in the previous 7 days, a ${pct.toFixed(1)}% increase.`;
  }

  if (/how much have we made|how much did we make|profit|net profit|gross profit/.test(q)) {
    if (role === "staff") return "Profit and private financial results are restricted to the store owner.";
    const p = await profit(ownerId, storeId, days);
    return `For ${periodLabel(days)}: revenue is ${money(p.revenue)} from ${p.orders} order(s); recorded gross profit from items with cost prices is ${money(p.gross)}; recorded expenses are ${money(p.expenses)}; estimated net profit is ${money(p.net)}.`;
  }

  if (/low stock|out of stock|restock|inventory|stock left|what.*stock/.test(q)) {
    const rows = await prisma.inventory.findMany({
      where: { ownerId, storeId },
      orderBy: { quantity: "asc" },
      take: 120,
      select: { name: true, quantity: true, restockLevel: true },
    });
    const low = rows.filter((item) => item.restockLevel != null && Number(item.quantity) <= Number(item.restockLevel));
    if (/out of stock/.test(q)) {
      const out = rows.filter((item) => Number(item.quantity) <= 0).slice(0, 15);
      return out.length ? `Out-of-stock items: ${out.map((x) => x.name).join(", ")}.` : "There are no items currently at zero stock.";
    }
    return low.length
      ? `I found ${low.length} item(s) at or below their restock level: ${low.slice(0, 15).map((x) => `${x.name} (${x.quantity} left)`).join(", ")}.`
      : "No items are currently at or below their recorded restock level.";
  }

  if (/top|best|most sold|fastest selling|popular|selling products|selling items|best stock/.test(q) && /sell|selling|sale|product|item|stock/.test(q)) {
    const rows = await prisma.orderItem.findMany({
      where: { order: { ownerId, storeId, date: { gte: since(days) } } },
      select: { quantity: true, inventory: { select: { name: true, price: true } } },
    });
    const totals = new Map<string, { quantity: number; price: number }>();
    for (const row of rows) {
      const name = row.inventory.name;
      const old = totals.get(name) ?? { quantity: 0, price: Number(row.inventory.price ?? 0) };
      old.quantity += Number(row.quantity);
      totals.set(name, old);
    }
    const best = [...totals.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5);
    return best.length
      ? `Top-selling products for ${periodLabel(days)}: ${best.map(([name, v], i) => `${i + 1}. ${name} — ${v.quantity} unit(s)`).join("; ")}.`
      : `There are no recorded product sales in ${periodLabel(days)}.`;
  }

  if (/who owes|debtor|debt|owe|owes|credit sale/.test(q)) {
    if (role === "staff") return "Debtor balances and credit-sale information are restricted to the store owner.";
    const rows = await prisma.debt.findMany({
      where: { ownerId, storeId },
      select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } },
    });
    const open = rows
      .map((x) => ({ name: x.customer.name, owed: Number(x.totalAmount) - Number(x.amountPaid) }))
      .filter((x) => x.owed > 0)
      .sort((a, b) => b.owed - a.owed);
    if (!open.length) return "There are no outstanding debtor balances for this store.";
    const total = open.reduce((sum, x) => sum + x.owed, 0);
    return `${open.length} customer(s) have outstanding balances. The largest is ${open[0].name}, owing ${money(open[0].owed)}. Total outstanding is ${money(total)}.`;
  }

  if (/expense|expenses|spent|spending/.test(q)) {
    if (role === "staff") return "Private business expenses and spending are restricted to the store owner.";
    const result = await prisma.expense.aggregate({
      where: { ownerId, storeId, createdAt: { gte: since(days) } },
      _sum: { amount: true },
      _count: true,
    });
    return `Recorded expenses for ${periodLabel(days)} total ${money(result._sum.amount)} across ${result._count} record(s).`;
  }

  return null;
}

async function buildContext(role: Role, ownerId: number, storeId: number, staffId: number, question: string) {
  const days = periodDays(question);
  const store = await prisma.store.findFirst({
    where: { id: storeId, ownerId },
    select: { name: true, storeType: true, city: true, state: true },
  });
  const totals = await sales(ownerId, storeId, days, role === "staff" ? staffId : undefined);
  const inventory = await prisma.inventory.findMany({
    where: { ownerId, storeId },
    orderBy: { quantity: "asc" },
    take: 100,
    select: { name: true, quantity: true, price: true, restockLevel: true, expiryDate: true },
  });

  const lines = [
    `STORE: ${store?.name ?? "Unknown"}`,
    `STORE TYPE: ${store?.storeType ?? "Unknown"}`,
    `LOCATION: ${[store?.city, store?.state].filter(Boolean).join(", ") || "Unknown"}`,
    `PERIOD: ${periodLabel(days)}`,
    `SALES: ${money(totals._sum.total)}`,
    `ORDERS: ${totals._count}`,
    `INVENTORY SAMPLE: ${inventory.slice(0, 70).map((x) => `${x.name} | qty=${x.quantity} | price=${money(x.price)} | restock=${x.restockLevel ?? "—"}`).join(" || ") || "No inventory records"}`,
  ];

  if (role === "owner") {
    const p = await profit(ownerId, storeId, days);
    lines.push(`OWNER FINANCIALS: revenue=${money(p.revenue)} | gross=${money(p.gross)} | expenses=${money(p.expenses)} | estimatedNet=${money(p.net)}`);
  } else {
    lines.push("STAFF SECURITY: Do not reveal owner profit, expenses, debts, payroll, supplier information, refunds, wastage, other staff performance, other stores, or private owner data.");
  }

  return lines.join("\n").slice(0, MAX_CONTEXT);
}

function systemPrompt(role: Role, liveData: string) {
  return [
    role === "owner"
      ? "You are Ask Me, the private business assistant for the authenticated Garrison Market store owner."
      : "You are Ask Me, the staff assistant for the authenticated Garrison Market store.",
    "Use the supplied live store data for business facts. Never invent numbers, customers, products, staff, transactions or financial results.",
    "Never mix information between stores. The current authenticated store is the only store you may discuss.",
    role === "staff"
      ? "Staff must never receive owner-only financials, debts, expenses, payroll, supplier information, refunds, wastage, other staff performance, other stores, or private owner information. If asked, politely refuse that part."
      : "The owner may receive private financial information for the currently selected store.",
    "Answer the user's actual question directly. Do not tell them to visit another page when the supplied data can answer it.",
    "If the live data is insufficient, say what is missing rather than guessing.",
    "Keep answers concise and useful.",
    "",
    "LIVE STORE DATA:",
    liveData,
  ].join("\n");
}

function extractText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part: any) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

async function askOpenRouter(messages: any[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { reply: "", error: "Ask Me is not configured yet: OPENROUTER_API_KEY is missing." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://garrison-market.vercel.app",
        "X-Title": "Garrison Market Ask Me",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1200,
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any = null;
    try { payload = JSON.parse(raw); } catch { /* handled below */ }

    if (!response.ok) {
      console.error("ASK_ME_OPENROUTER_ERROR", response.status, raw.slice(0, 3000));
      return { reply: "", error: `The AI provider returned an error (${response.status}). Please try again.` };
    }

    const reply = extractText(payload);
    if (!reply) {
      console.error("ASK_ME_EMPTY_OPENROUTER_RESPONSE", JSON.stringify({ finishReason: payload?.choices?.[0]?.finish_reason, usage: payload?.usage, error: payload?.error }, null, 2).slice(0, 4000));
      return { reply: "", error: "The AI provider returned no readable answer. Please try again." };
    }

    return { reply, error: "" };
  } catch (error) {
    console.error("ASK_ME_OPENROUTER_FETCH_ERROR", error);
    return { reply: "", error: error instanceof Error && error.name === "AbortError" ? "The AI service took too long to respond. Please try again." : "Ask Me could not reach the AI service. Please try again." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== "owner" && session.role !== "staff")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: ChatMessage[] = rawHistory
      .slice(-MAX_HISTORY)
      .map((item: any) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: String(item?.content ?? "").slice(0, MAX_CHARS),
      }))
      .filter((item: ChatMessage) => item.content.trim());

    const question = history.filter((m) => m.role === "user").at(-1)?.content?.trim() ?? "";
    if (!question && !body?.imageDataUrl) {
      return NextResponse.json({ success: false, error: "Please ask a question." }, { status: 400 });
    }

    const storeId = await getActiveStoreId();
    if (!storeId) return NextResponse.json({ success: false, error: "No active store is available for this account." }, { status: 400 });

    const role = session.role as Role;
    const ownerId = Number(session.ownerId ?? session.id);
    const staffId = Number(session.id);

    const store = await prisma.store.findFirst({ where: { id: storeId, ownerId }, select: { id: true } });
    if (!store) return NextResponse.json({ success: false, error: "This store is not available to the current account." }, { status: 403 });

    const direct = await directAnswer(role, ownerId, storeId, staffId, question);
    if (direct) return NextResponse.json({ success: true, reply: direct, products: [] });

    const liveData = await buildContext(role, ownerId, storeId, staffId, question);
    const system = systemPrompt(role, liveData);

    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ success: false, error: "That image is too large to analyze. Please attach a smaller image." }, { status: 413 });
    }

    const userContent = imageDataUrl
      ? [
          { type: "text", text: question || "Please analyze this image in the context of my Garrison Market store." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : question;

    const messages = [
      { role: "system", content: system },
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    ];
    messages[messages.length - 1] = { role: "user", content: userContent };

    const ai = await askOpenRouter(messages);
    if (!ai.reply) {
      return NextResponse.json({ success: false, error: ai.error || "Ask Me could not produce an answer." }, { status: 502 });
    }

    return NextResponse.json({ success: true, reply: ai.reply, products: [] });
  } catch (error) {
    console.error("ASK_ME_ROUTE_ERROR", error);
    return NextResponse.json({ success: false, error: "Ask Me encountered a server error. Please try again." }, { status: 500 });
  }
}
