import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import prisma from "@/lib/prisma";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Use a stable non-reasoning multimodal model first. This avoids responses being
// consumed by hidden reasoning tokens before a visible answer is produced.
const MODEL = "openai/gpt-4o-mini";
const MAX_HISTORY = 8;
const MAX_CHARS = 1800;
const MAX_CONTEXT = 24000;
const MAX_IMAGE = 6_000_000;

type Message = { role: "user" | "assistant"; content: string };
type Role = "owner" | "staff";

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n)
    : "₦0";
};

const daysFor = (q: string) => {
  const s = q.toLowerCase();
  if (s.includes("today")) return 1;
  if (s.includes("yesterday")) return 2;
  if (s.includes("week")) return 7;
  if (s.includes("month")) return 30;
  if (s.includes("year")) return 365;
  return 14;
};

const date = (v: unknown) => v ? new Date(String(v)).toLocaleString("en-NG") : "—";

const staffRestricted = (q: string) => /profit|margin|net profit|expense|expenses|spent|spending|debt|debtor|owe|owes|credit|part[- ]?payment|wastage|waste|stock loss|refund|supplier|salary|payroll|best staff|staff ranking|other staff|other store/i.test(q);

async function sales(ownerId: number, storeId: number, days: number, staffId?: number) {
  const where: any = { ownerId, storeId, date: { gte: new Date(Date.now() - days * 86400000) } };
  if (staffId) where.staffId = staffId;
  return prisma.order.aggregate({ where, _sum: { total: true }, _count: true });
}

async function profit(ownerId: number, storeId: number, days: number) {
  const since = new Date(Date.now() - days * 86400000);
  const orders = await prisma.order.findMany({
    where: { ownerId, storeId, date: { gte: since } },
    select: { total: true, items: { select: { quantity: true, priceAtTime: true, inventory: { select: { costPrice: true } } } } }
  });
  let revenue = 0;
  let gross = 0;
  for (const order of orders) {
    revenue += Number(order.total);
    for (const item of order.items) {
      if (item.inventory.costPrice != null) gross += Number(item.quantity) * (Number(item.priceAtTime) - Number(item.inventory.costPrice));
    }
  }
  const expenseSum = await prisma.expense.aggregate({
    where: { ownerId, storeId, createdAt: { gte: since } },
    _sum: { amount: true }
  });
  const expenses = Number(expenseSum._sum.amount ?? 0);
  return { revenue, gross, expenses, net: gross - expenses, orders: orders.length };
}

async function directAnswer(role: Role, ownerId: number, storeId: number, staffId: number, q: string) {
  const s = q.toLowerCase();
  const days = daysFor(s);

  if (/latest sale|last sale|most recent sale/.test(s)) {
    const where: any = { ownerId, storeId, date: { gte: new Date(Date.now() - days * 86400000) } };
    if (role === "staff") where.staffId = staffId;
    const order = await prisma.order.findFirst({ where, orderBy: { date: "desc" }, select: { total: true, date: true, paymentMethod: true } });
    return order ? `The latest recorded sale in this period was ${money(order.total)} on ${date(order.date)} via ${order.paymentMethod}.` : "There are no recorded sales in this period.";
  }

  if (/why (are|is|did).*sales|why sales/.test(s)) {
    const now = await sales(ownerId, storeId, 7, role === "staff" ? staffId : undefined);
    const old = await prisma.order.aggregate({
      where: { ownerId, storeId, date: { gte: new Date(Date.now() - 14 * 86400000), lt: new Date(Date.now() - 7 * 86400000) }, ...(role === "staff" ? { staffId } : {}) },
      _sum: { total: true }, _count: true
    });
    const current = Number(now._sum.total ?? 0);
    const previous = Number(old._sum.total ?? 0);
    if (!previous) return `This week has ${money(current)} from ${now._count} recorded order(s). There is no previous-week baseline yet, so I cannot prove a cause for a decline.`;
    const pct = ((current - previous) / previous) * 100;
    return current < previous
      ? `Sales are down ${Math.abs(pct).toFixed(1)}%: ${money(current)} this week from ${now._count} order(s), versus ${money(previous)} in the previous 7 days. The data confirms the decline but does not by itself prove the cause.`
      : `Sales are not down: this week is ${money(current)} versus ${money(previous)} in the previous 7 days, a ${Math.abs(pct).toFixed(1)}% increase.`;
  }

  if (/how much did we sell|total sales|sales total|how much was sold|sales so far/.test(s)) {
    const a = await sales(ownerId, storeId, days, role === "staff" ? staffId : undefined);
    const label = days === 1 ? "today" : days === 7 ? "this week" : days === 30 ? "this month" : `the last ${days} days`;
    return `For ${label}, the live store data shows ${money(a._sum.total)} across ${a._count} recorded order(s).`;
  }

  if (/how much have we made|how much did we make|profit|net profit|gross profit/.test(s)) {
    if (role === "staff") return "Profit and business financial results are restricted to the store owner.";
    const p = await profit(ownerId, storeId, days);
    const label = days === 1 ? "today" : days === 7 ? "this week" : days === 30 ? "this month" : `the last ${days} days`;
    return `For ${label}: sales revenue is ${money(p.revenue)} from ${p.orders} order(s). Recorded gross profit from items with cost prices is ${money(p.gross)}. Recorded expenses are ${money(p.expenses)}, giving an estimated net profit of ${money(p.net)}.`;
  }

  if (/low stock|out of stock|restock|inventory|stock/.test(s)) {
    const rows = await prisma.inventory.findMany({ where: { ownerId, storeId }, orderBy: { quantity: "asc" }, take: 120, select: { name: true, quantity: true, restockLevel: true } });
    const low = rows.filter(p => p.restockLevel != null && Number(p.quantity) <= Number(p.restockLevel));
    return low.length
      ? `I found ${low.length} item(s) at or below their restock level: ${low.slice(0, 15).map(p => `${p.name} (${p.quantity} left)`).join(", ")}.`
      : "No items are currently at or below their recorded restock level.";
  }

  if (/top sale|best sale|best selling|top selling|most sold|best seller/.test(s)) {
    const rows = await prisma.orderItem.findMany({
      where: { order: { ownerId, storeId, date: { gte: new Date(Date.now() - days * 86400000) } } },
      select: { quantity: true, inventory: { select: { name: true } } }
    });
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.inventory.name, (totals.get(row.inventory.name) ?? 0) + Number(row.quantity));
    const best = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return best.length ? `Top-selling items for this period: ${best.map(([name, qty], i) => `${i + 1}. ${name} (${qty} unit(s))`).join("; ")}.` : "There are no recorded item sales for this period.";
  }

  if (/who owes|debtor|debt|owe|owes/.test(s)) {
    if (role === "staff") return "Debts and debtor balances are restricted to the store owner.";
    const rows = await prisma.debt.findMany({ where: { ownerId, storeId }, select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } } });
    const open = rows.map(x => ({ name: x.customer.name, owed: Number(x.totalAmount) - Number(x.amountPaid) })).filter(x => x.owed > 0).sort((a, b) => b.owed - a.owed);
    return open.length
      ? `${open.length} customer(s) have outstanding balances. The largest is ${open[0].name} owing ${money(open[0].owed)}. Total outstanding is ${money(open.reduce((n, x) => n + x.owed, 0))}.`
      : "There are no outstanding debtor balances for this store.";
  }

  if (/expense|expenses|spent|spending/.test(s)) {
    if (role === "staff") return "Expenses and business spending are restricted to the store owner.";
    const a = await prisma.expense.aggregate({ where: { ownerId, storeId, createdAt: { gte: new Date(Date.now() - days * 86400000) } }, _sum: { amount: true }, _count: true });
    return `Recorded expenses for the last ${days} day(s) total ${money(a._sum.amount)} across ${a._count} record(s).`;
  }

  return null;
}

async function context(role: Role, ownerId: number, storeId: number, staffId: number, q: string) {
  const days = daysFor(q);
  const store = await prisma.store.findFirst({ where: { id: storeId, ownerId }, select: { name: true, storeType: true, city: true, state: true } });
  const a = await sales(ownerId, storeId, days, role === "staff" ? staffId : undefined);
  const rows = await prisma.inventory.findMany({ where: { ownerId, storeId }, orderBy: { quantity: "asc" }, take: 100, select: { name: true, quantity: true, price: true, restockLevel: true, expiryDate: true } });
  const out = [
    `CURRENT STORE: ${store?.name ?? "Unknown"}`,
    `PERIOD: last ${days} days`,
    `SALES: ${money(a._sum.total)}`,
    `ORDERS: ${a._count}`,
    `LOW STOCK: ${rows.filter(x => x.restockLevel != null && Number(x.quantity) <= Number(x.restockLevel)).slice(0, 20).map(x => `${x.name} (${x.quantity})`).join(", ") || "None"}`
  ];
  if (role === "owner") {
    const p = await profit(ownerId, storeId, days);
    out.push(`GROSS PROFIT: ${money(p.gross)}`, `EXPENSES: ${money(p.expenses)}`, `ESTIMATED NET PROFIT: ${money(p.net)}`);
  } else {
    out.push("STAFF RESTRICTIONS: no owner profit, expenses, debts, supplier refunds, salaries, other stores or other staff performance.");
  }
  return out.join("\n").slice(0, MAX_CONTEXT);
}

function systemPrompt(role: Role, data: string) {
  return `${role === "owner" ? "You are the private Garrison Market assistant for the authenticated store owner." : "You are the Garrison Market staff assistant."}\nUse only the supplied live data for business facts. Never invent numbers. Never mix stores. Staff must never receive owner-only financials or other staff/store data. Answer directly, naturally and concisely. If the supplied data is insufficient, say exactly what is missing instead of sending the user to a different page.\n\nLIVE DATA:\n${data}`;
}

const extract = (payload: any) => {
  const message = payload?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part: any) => typeof part?.text === "string" ? part.text : typeof part === "string" ? part : "").join("").trim();
    if (text) return text;
  }
  // Some OpenRouter/provider responses can put usable text in a nested output array.
  const output = payload?.output;
  if (Array.isArray(output)) {
    const text = output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
    if (text) return text;
  }
  return "";
};

async function callOpenRouter(messages: any[], imageDataUrl?: string) {
  const requestBody: any = {
    model: MODEL,
    messages,
    temperature: 0.3,
    max_completion_tokens: 1600,
    stream: false
  };
  if (imageDataUrl) requestBody.messages = messages;

  let lastStatus = 0;
  let lastRaw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://garrison-market.vercel.app",
          "X-Title": "Garrison Market Ask Me"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        cache: "no-store"
      });
      lastStatus = response.status;
      lastRaw = await response.text();
      if (response.ok) {
        try {
          const payload = JSON.parse(lastRaw);
          const reply = extract(payload);
          if (reply) return { reply, status: response.status, raw: lastRaw };
          console.error("ASK_ME_EMPTY_RESPONSE", JSON.stringify({ status: response.status, finishReason: payload?.choices?.[0]?.finish_reason, usage: payload?.usage, message: payload?.choices?.[0]?.message }, null, 2).slice(0, 4000));
        } catch {
          console.error("ASK_ME_INVALID_RESPONSE", lastRaw.slice(0, 2000));
        }
      } else {
        console.error("ASK_ME_OPENROUTER_ERROR", response.status, lastRaw.slice(0, 2000));
      }
    } catch (error) {
      console.error("ASK_ME_OPENROUTER_FETCH_ERROR", error);
      lastRaw = String(error);
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return { reply: "", status: lastStatus, raw: lastRaw };
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getSessionUser();
    if (!session || (session.role !== "owner" && session.role !== "staff")) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const history: Message[] = Array.isArray(body?.history)
      ? body.history.slice(-MAX_HISTORY).map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: String(m?.content ?? "").slice(0, MAX_CHARS) })).filter((m: Message) => m.content.trim())
      : [];
    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : undefined;

    if (!history.length && !imageDataUrl) return NextResponse.json({ success: false, error: "Please ask a question." }, { status: 400 });
    if (imageDataUrl && (imageDataUrl.length > MAX_IMAGE || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl))) return NextResponse.json({ success: false, error: "Please attach a JPEG, PNG, or WebP image under 6MB." }, { status: 400 });

    const storeId = Number(await getActiveStoreId());
    if (!storeId) return NextResponse.json({ success: false, error: "No active store is assigned to this account." }, { status: 403 });

    const ownerId = Number(session.role === "owner" ? session.id : session.ownerId);
    const staffId = Number(session.id);
    if (!Number.isFinite(ownerId) || ownerId <= 0) return NextResponse.json({ success: false, error: "This account is not linked to a store owner." }, { status: 403 });

    if (session.role === "owner") {
      const ok = await prisma.store.findFirst({ where: { id: storeId, ownerId }, select: { id: true } });
      if (!ok) return NextResponse.json({ success: false, error: "Your active store could not be verified." }, { status: 403 });
    } else {
      const ok = await prisma.user.findFirst({ where: { id: staffId, role: "staff", ownerId, staffStoreId: storeId }, select: { id: true } });
      if (!ok) return NextResponse.json({ success: false, error: "Your staff store assignment could not be verified." }, { status: 403 });
    }

    const q = history.at(-1)?.content.trim() ?? "";
    if (session.role === "staff" && staffRestricted(q)) return NextResponse.json({ success: true, reply: "I can help with staff-safe store information, inventory and your sales. That information is restricted to the store owner." });

    if (!imageDataUrl) {
      const answer = await directAnswer(session.role, ownerId, storeId, staffId, q);
      if (answer) return NextResponse.json({ success: true, reply: answer });
    }

    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ success: false, error: "Ask Me is not configured on the server. Add OPENROUTER_API_KEY to the deployment environment." }, { status: 503 });

    const data = await context(session.role, ownerId, storeId, staffId, q);
    const messages: any[] = [
      { role: "system", content: systemPrompt(session.role, data) },
      ...history
    ];

    if (imageDataUrl) {
      const last = messages.at(-1);
      if (last?.role === "user") {
        last.content = [
          { type: "text", text: last.content || "Analyze this image using the supplied store data." },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ];
      }
    }

    const result = await callOpenRouter(messages, imageDataUrl);
    if (result.reply) return NextResponse.json({ success: true, reply: result.reply });

    let providerMessage = "";
    try { providerMessage = String(JSON.parse(result.raw)?.error?.message ?? "").slice(0, 300); } catch {}
    return NextResponse.json({
      success: false,
      error: result.status === 429
        ? "The AI provider is temporarily rate-limited. Please try again shortly."
        : providerMessage
          ? `Ask Me's AI service returned an error: ${providerMessage}`
          : "Ask Me could not produce a visible answer. Please try again."
    }, { status: 502 });
  } catch (error) {
    console.error("ASK_ME_API_ERROR", error);
    return NextResponse.json({ success: false, error: "Ask Me could not complete that request. Please try again." }, { status: 500 });
  }
}
