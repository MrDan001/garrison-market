import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import prisma from "@/lib/prisma";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.6-27b";
const MAX_HISTORY = 8;
const MAX_CHARS = 1800;
const MAX_CONTEXT = 24000;
const MAX_IMAGE = 6_000_000;

type Message = { role: "user" | "assistant"; content: string };
type Role = "owner" | "staff";

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n) : "₦0";
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
  let revenue = 0, gross = 0;
  for (const o of orders) {
    revenue += Number(o.total);
    for (const i of o.items) {
      if (i.inventory.costPrice != null) gross += Number(i.quantity) * (Number(i.priceAtTime) - Number(i.inventory.costPrice));
    }
  }
  const e = await prisma.expense.aggregate({ where: { ownerId, storeId, createdAt: { gte: since } }, _sum: { amount: true } });
  const expenses = Number(e._sum.amount ?? 0);
  return { revenue, gross, expenses, net: gross - expenses, orders: orders.length };
}

async function directAnswer(role: Role, ownerId: number, storeId: number, staffId: number, q: string) {
  const s = q.toLowerCase();
  const days = daysFor(s);
  if (/latest sale|last sale|most recent sale/.test(s)) {
    const where: any = { ownerId, storeId, date: { gte: new Date(Date.now() - days * 86400000) } };
    if (role === "staff") where.staffId = staffId;
    const o = await prisma.order.findFirst({ where, orderBy: { date: "desc" }, select: { total: true, date: true, paymentMethod: true } });
    return o ? `The latest recorded sale in this period was ${money(o.total)} on ${date(o.date)} via ${o.paymentMethod}.` : `There are no recorded sales in this period.`;
  }
  if (/why (are|is|did).*sales|why sales/.test(s)) {
    const now = await sales(ownerId, storeId, 7, role === "staff" ? staffId : undefined);
    const old = await prisma.order.aggregate({ where: { ownerId, storeId, date: { gte: new Date(Date.now() - 14 * 86400000), lt: new Date(Date.now() - 7 * 86400000) }, ...(role === "staff" ? { staffId } : {}) }, _sum: { total: true }, _count: true });
    const a = Number(now._sum.total ?? 0), b = Number(old._sum.total ?? 0);
    if (!b) return `This week has ${money(a)} from ${now._count} recorded order(s). There is no previous-week baseline yet, so I cannot claim a cause for a decline.`;
    const pct = ((a - b) / b) * 100;
    return a < b ? `Sales are down ${Math.abs(pct).toFixed(1)}%: ${money(a)} this week from ${now._count} order(s), versus ${money(b)} in the previous 7 days. The data confirms the decline but does not prove its cause.` : `Sales are not down: this week is ${money(a)} versus ${money(b)} in the previous 7 days, a ${Math.abs(pct).toFixed(1)}% increase.`;
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
    return low.length ? `I found ${low.length} item(s) at or below their restock level: ${low.slice(0, 15).map(p => `${p.name} (${p.quantity} left)`).join(", ")}.` : "No items are currently at or below their recorded restock level.";
  }
  if (/who owes|debtor|debt|owe|owes/.test(s)) {
    if (role === "staff") return "Debts and debtor balances are restricted to the store owner.";
    const rows = await prisma.debt.findMany({ where: { ownerId, storeId }, select: { totalAmount: true, amountPaid: true, customer: { select: { name: true } } } });
    const open = rows.map(x => ({ name: x.customer.name, owed: Number(x.totalAmount) - Number(x.amountPaid) })).filter(x => x.owed > 0).sort((a,b) => b.owed-a.owed);
    return open.length ? `${open.length} customer(s) have outstanding balances. The largest is ${open[0].name} owing ${money(open[0].owed)}. Total outstanding is ${money(open.reduce((n,x) => n+x.owed, 0))}.` : "There are no outstanding debtor balances for this store.";
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
  const out = [`CURRENT STORE: ${store?.name ?? "Unknown"}`, `PERIOD: last ${days} days`, `SALES: ${money(a._sum.total)}`, `ORDERS: ${a._count}`, `LOW STOCK: ${rows.filter(x => x.restockLevel != null && Number(x.quantity) <= Number(x.restockLevel)).slice(0,20).map(x => `${x.name} (${x.quantity})`).join(", ") || "None"}`];
  if (role === "owner") { const p = await profit(ownerId, storeId, days); out.push(`GROSS PROFIT: ${money(p.gross)}`, `EXPENSES: ${money(p.expenses)}`, `ESTIMATED NET PROFIT: ${money(p.net)}`); }
  else out.push("STAFF RESTRICTIONS: no owner profit, expenses, debts, supplier refunds, salaries, other stores or other staff performance.");
  return out.join("\n").slice(0, MAX_CONTEXT);
}

function systemPrompt(role: Role, data: string) {
  return `${role === "owner" ? "You are the private Garrison Market assistant for the authenticated store owner." : "You are the Garrison Market staff assistant."}\nUse only the supplied live data for business facts. Never invent numbers. Never mix stores. Staff must never receive owner-only financials or other staff/store data. Answer directly and concisely.\n\nLIVE DATA:\n${data}`;
}

const extract = (p: any) => {
  const content = p?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
  return "";
};

export async function POST(request: NextRequest) {
  try {
    const session: any = await getSessionUser();
    if (!session || (session.role !== "owner" && session.role !== "staff")) return NextResponse.json({ success:false, error:"Unauthorized" }, { status:401 });
    const body = await request.json().catch(() => null);
    const history: Message[] = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY).map((m:any) => ({ role:m?.role === "assistant" ? "assistant" : "user", content:String(m?.content ?? "").slice(0,MAX_CHARS) })) : [];
    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : undefined;
    if (!history.length && !imageDataUrl) return NextResponse.json({ success:false, error:"Please ask a question." }, { status:400 });
    if (imageDataUrl && (imageDataUrl.length > MAX_IMAGE || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl))) return NextResponse.json({ success:false, error:"Please attach a JPEG, PNG, or WebP image under 6MB." }, { status:400 });
    const storeId = Number(await getActiveStoreId());
    if (!storeId) return NextResponse.json({ success:false, error:"No active store is assigned to this account." }, { status:403 });
    const ownerId = Number(session.role === "owner" ? session.id : session.ownerId);
    const staffId = Number(session.id);
    if (!Number.isFinite(ownerId) || ownerId <= 0) return NextResponse.json({ success:false, error:"This account is not linked to a store owner." }, { status:403 });
    if (session.role === "owner") {
      const ok = await prisma.store.findFirst({ where:{ id:storeId, ownerId }, select:{id:true} });
      if (!ok) return NextResponse.json({ success:false, error:"Your active store could not be verified." }, { status:403 });
    } else {
      const ok = await prisma.user.findFirst({ where:{ id:staffId, role:"staff", ownerId, staffStoreId:storeId }, select:{id:true} });
      if (!ok) return NextResponse.json({ success:false, error:"Your staff store assignment could not be verified." }, { status:403 });
    }
    const q = history.at(-1)?.content.trim() ?? "";
    if (session.role === "staff" && staffRestricted(q)) return NextResponse.json({ success:true, reply:"I can help with staff-safe store information, inventory and your sales. That information is restricted to the store owner." });
    if (!imageDataUrl) { const answer = await directAnswer(session.role, ownerId, storeId, staffId, q); if (answer) return NextResponse.json({ success:true, reply:answer }); }
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ success:false, error:"Ask Me is not configured on the server. Add OPENROUTER_API_KEY to the deployment environment." }, { status:503 });
    const data = await context(session.role, ownerId, storeId, staffId, q);
    const messages:any[] = [{ role:"system", content:systemPrompt(session.role, data) }, ...history];
    if (imageDataUrl) { const last = messages.at(-1); if (last?.role === "user") last.content = [{ type:"text", text:last.content || "Analyze this image using the supplied store data." }, { type:"image_url", image_url:{url:imageDataUrl} }]; }
    const requestBody = { model:MODEL, messages, temperature:0.7, max_tokens:1200, stream:false };
    let response:Response | null = null, raw = "";
    for (let attempt=0; attempt<2; attempt++) {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        response = await fetch(OPENROUTER_ENDPOINT, {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://garrison-market.vercel.app",
            "X-Title": "Garrison Market Ask Me"
          },
          body:JSON.stringify(requestBody),
          signal:controller.signal,
          cache:"no-store"
        });
        raw = await response.text();
      } finally { clearTimeout(timeout); }
      if (![429,500,502,503,504].includes(response?.status ?? 0) || attempt === 1) break;
      await new Promise(r => setTimeout(r, 1200));
    }
    if (!response?.ok) {
      console.error("ASK_ME_OPENROUTER_ERROR", response?.status, raw.slice(0,2000));
      let providerMessage = "";
      try { providerMessage = String(JSON.parse(raw)?.error?.message ?? "").slice(0,300); } catch {}
      return NextResponse.json({ success:false, error:response?.status === 429 ? "The AI provider is temporarily rate-limited. Please try again shortly." : providerMessage ? `Ask Me's AI service returned an error: ${providerMessage}` : "Ask Me's AI service could not process that request." }, { status:502 });
    }
    let payload:any;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ success:false, error:"Ask Me received an invalid AI response." }, { status:502 }); }
    const reply = extract(payload);
    if (!reply) {
      console.error("ASK_ME_EMPTY_RESPONSE", raw.slice(0,2000));
      return NextResponse.json({ success:false, error:"Ask Me received an empty AI response." }, { status:502 });
    }
    return NextResponse.json({ success:true, reply });
  } catch (error) {
    console.error("ASK_ME_API_ERROR", error);
    return NextResponse.json({ success:false, error:"Ask Me could not complete that request. Please try again." }, { status:500 });
  }
}
