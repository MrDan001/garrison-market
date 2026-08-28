import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";
import { getActiveStoreId } from "@/lib/store-context";
import prisma from "@/lib/prisma";
import { assistantSystemPrompt, buildStoreAssistantIntelligence, type AssistantRole } from "@/lib/store-assistant-intelligence";
import { buildStoreAssistantStage2 } from "@/lib/store-assistant-stage2";
import { buildStoreAssistantStage3, getStage3BlockedReply } from "@/lib/store-assistant-stage3";
import { buildStoreAssistantStage4 } from "@/lib/store-assistant-stage4";
import { buildStoreAssistantStage5 } from "@/lib/store-assistant-stage5";
import { buildStoreAssistantStage6 } from "@/lib/store-assistant-stage6";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openrouter/free";
const MAX_HISTORY = 10;
const MAX_CHARS = 2400;
const MAX_IMAGE_CHARS = 3_500_000;

type ChatMessage = { role: "user" | "assistant"; content: string };
function isGreeting(q: string) { return /^(hi|hello|hey|helo|helli|good morning|good afternoon|good evening|how are you)[!?. ]*$/i.test(q.trim()); }
function money(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n) : "₦0"; }
function periodDays(question: string) { const q = question.toLowerCase(); if (q.includes("today")) return 1; if (q.includes("yesterday")) return 2; if (q.includes("week")) return 7; if (q.includes("month")) return 30; if (q.includes("year")) return 365; return 14; }
function since(days: number) { return new Date(Date.now() - days * 86_400_000); }

async function directAnswer(role: AssistantRole, ownerId: number, storeId: number, staffId: number, question: string) {
  const q = question.toLowerCase().trim();
  if (isGreeting(q)) return "Hello! I’m Ask Me, your Garrison Market assistant. I can work with this store’s live business data, staff activity and Rush information while respecting owner/staff privacy.";
  const days = periodDays(q);
  if (/how much did we sell|total sales|sales total|how much was sold|sales so far|sales for/.test(q)) {
    const where: any = { ownerId, storeId, date: { gte: since(days) } }; if (role === "staff") where.staffId = staffId;
    const result = await prisma.order.aggregate({ where, _sum: { total: true }, _count: true });
    const label = days === 1 ? "today" : days === 7 ? "this week" : days === 30 ? "this month" : `the last ${days} days`;
    return `For ${label}, the live data shows ${money(result._sum.total)} across ${result._count} recorded order(s).`;
  }
  if (/latest sale|last sale|most recent sale/.test(q)) {
    const where: any = { ownerId, storeId, date: { gte: since(days) } }; if (role === "staff") where.staffId = staffId;
    const order = await prisma.order.findFirst({ where, orderBy: { date: "desc" }, select: { total: true, date: true, paymentMethod: true } });
    return order ? `The latest recorded sale was ${money(order.total)} via ${order.paymentMethod} on ${order.date.toLocaleString("en-NG")}.` : "There are no recorded sales in the requested period.";
  }
  if (/slow.?moving|moving slowly|which products.*slow|what products.*slow|slow products/.test(q)) {
    const from30 = since(30); const orderWhere: any = { ownerId, storeId, date: { gte: from30 } }; if (role === "staff") orderWhere.staffId = staffId;
    const [inventory, scaleInventory, orderItems, scaleOrderItems] = await Promise.all([
      prisma.inventory.findMany({ where: { ownerId, OR: [{ storeId }, { storeId: null }] }, select: { name: true, quantity: true, restockLevel: true } }),
      prisma.scaleInventory.findMany({ where: { ownerId, OR: [{ storeId }, { storeId: null }] }, select: { name: true, quantity: true, unit: true, restockLevel: true } }),
      prisma.orderItem.findMany({ where: { order: orderWhere }, select: { quantity: true, inventory: { select: { name: true } } }, take: 5000 }),
      prisma.scaleOrderItem.findMany({ where: { order: orderWhere }, select: { quantity: true, quantityInBaseUnit: true, scaleInventory: { select: { name: true, unit: true } } }, take: 5000 }),
    ]);
    const sold = new Map<string, number>();
    for (const item of orderItems) sold.set(item.inventory.name, (sold.get(item.inventory.name) ?? 0) + Number(item.quantity ?? 0));
    for (const item of scaleOrderItems) sold.set(item.scaleInventory.name, (sold.get(item.scaleInventory.name) ?? 0) + Number(item.quantityInBaseUnit ?? item.quantity ?? 0));
    const rows = [...inventory.map((item) => ({ name: item.name, qty: Number(item.quantity ?? 0), unit: "unit(s)", sold: sold.get(item.name) ?? 0 })), ...scaleInventory.map((item) => ({ name: item.name, qty: Number(item.quantity ?? 0), unit: item.unit, sold: sold.get(item.name) ?? 0 }))].filter((item) => item.qty > 0 && item.sold <= 2).sort((a, b) => a.sold - b.sold || b.qty - a.qty).slice(0, 10);
    if (!rows.length) return "I checked the live inventory and the last 30 days of sales. I don't currently see any in-stock products meeting the slow-moving threshold (2 or fewer units/base-units sold in 30 days).";
    const lines = rows.map((item, index) => `${index + 1}. ${item.name} — ${item.qty} ${item.unit} in stock; ${item.sold} sold in the last 30 days${item.sold === 0 ? " (no recorded sales)" : ""}.`);
    return `Here are the slow-moving products based on live store data from the last 30 days:\n\n${lines.join("\n")}\n\nThis is a sales-velocity signal, not a recommendation to discard or discount automatically. Review demand and stock value before taking action.`;
  }
  return null;
}

function extractText(payload: any) { const content = payload?.choices?.[0]?.message?.content; if (typeof content === "string" && content.trim()) return content.trim(); if (Array.isArray(content)) { const text = content.map((part: any) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("").trim(); if (text) return text; } return ""; }
function isRushTopic(text: string) { return /\b(rush|xp|experience|streak|spin|wheel|quest|restock run|sales sprint|leaderboard|badge|reward|level|clock in|clock out|on time|mvp)\b/i.test(text); }
function buildRushContextQuestion(question: string, history: ChatMessage[]) { const q = question.trim(); const previousUserQuestion = [...history].reverse().find((message) => message.role === "user" && message.content.trim())?.content.trim() ?? ""; if (!previousUserQuestion || !isRushTopic(previousUserQuestion)) return q; const normalized = q.toLowerCase(); const explicitRush = isRushTopic(q); const shortFollowUp = q.length <= 80 && (/^(show|show me|yes|yes please|okay|ok|sure|go ahead|do it|what about (that|it)|and then\??|then what\??|tell me more|more|how\??|why\??|which ones\??|what ones\??)[!?. ]*$/i.test(normalized) || !explicitRush && /^(what|which|how|why|when|where|who|can|could|tell|give|list)\b/i.test(normalized)); return shortFollowUp ? `Previous Rush question: ${previousUserQuestion}\nCurrent Rush follow-up: ${q}` : q; }

async function askOpenRouter(messages: any[]) {
  const apiKey = process.env.OPENROUTER_API_KEY; if (!apiKey) return { reply: "", error: "Ask Me is not configured yet: OPENROUTER_API_KEY is missing." };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(OPENROUTER_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://garrison-market.vercel.app", "X-Title": "Garrison Market Ask Me" }, body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: 1200, stream: false, provider: { allow_fallbacks: true } }), cache: "no-store", signal: controller.signal });
    const raw = await response.text(); let payload: any = null; try { payload = JSON.parse(raw); } catch {}
    if (!response.ok) { console.error("ASK_ME_OPENROUTER_ERROR", response.status, raw.slice(0, 3000)); if (response.status === 401) return { reply: "", error: "Ask Me could not authenticate with OpenRouter. Please check the OPENROUTER_API_KEY in Vercel." }; if (response.status === 402) return { reply: "", error: "OpenRouter's free model pool could not serve this request. Please try again shortly; Ask Me is configured not to use paid models." }; if (response.status === 404) return { reply: "", error: "OpenRouter could not reach the Free Models Router. Please retry after the latest deployment." }; if (response.status === 429) return { reply: "", error: "Ask Me is temporarily rate-limited by the free AI provider. Please try again in a moment." }; return { reply: "", error: `The AI provider returned an error (${response.status}). Please try again.` }; }
    const reply = extractText(payload); if (!reply) { console.error("ASK_ME_EMPTY_OPENROUTER_RESPONSE", JSON.stringify({ model: payload?.model, provider: payload?.provider, finishReason: payload?.choices?.[0]?.finish_reason, usage: payload?.usage, error: payload?.error }, null, 2).slice(0, 4000)); return { reply: "", error: "The AI provider returned no readable answer. Please try again." }; }
    return { reply, error: "" };
  } catch (error) { console.error("ASK_ME_OPENROUTER_FETCH_ERROR", error); return { reply: "", error: error instanceof Error && error.name === "AbortError" ? "The AI service took too long to respond. Please try again." : "Ask Me could not reach the AI service. Please try again." }; } finally { clearTimeout(timeout); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(); if (!session || (session.role !== "owner" && session.role !== "staff")) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null); const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: ChatMessage[] = rawHistory.slice(-MAX_HISTORY).map((item: any) => ({ role: item?.role === "assistant" ? "assistant" : "user", content: String(item?.content ?? "").slice(0, MAX_CHARS) })).filter((item: ChatMessage) => item.content.trim());
    const question = history.filter((m) => m.role === "user").at(-1)?.content?.trim() ?? ""; const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!question && !imageDataUrl) return NextResponse.json({ success: false, error: "Please ask a question." }, { status: 400 }); if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_CHARS) return NextResponse.json({ success: false, error: "That image is too large to analyze. Please attach a smaller image." }, { status: 413 });
    const storeId = await getActiveStoreId(); if (!storeId) return NextResponse.json({ success: false, error: "No active store is available for this account." }, { status: 400 });
    const role = session.role as AssistantRole; const ownerId = Number(session.ownerId ?? session.id); const staffId = Number(session.id);
    const store = await prisma.store.findFirst({ where: { id: storeId, ownerId }, select: { id: true } }); if (!store) return NextResponse.json({ success: false, error: "This store is not available to the current account." }, { status: 403 });
    const direct = await directAnswer(role, ownerId, storeId, staffId, question); if (direct) return NextResponse.json({ success: true, reply: direct, products: [] });
    const blocked = getStage3BlockedReply(role, question); if (blocked) return NextResponse.json({ success: true, reply: blocked, products: [] });
    const liveContext = await buildStoreAssistantIntelligence(role, ownerId, storeId, staffId, question);
    const stage2Analysis = await buildStoreAssistantStage2(role, ownerId, storeId, staffId, question);
    const stage3Access = buildStoreAssistantStage3(role, question);
    const stage4Question = buildRushContextQuestion(question, history); const stage4Rush = await buildStoreAssistantStage4(role, stage4Question);
    const stage5Recommendations = await buildStoreAssistantStage5(role, ownerId, storeId, staffId, question);
    const stage6Reliability = buildStoreAssistantStage6(role, question);
    const system = assistantSystemPrompt(role, `${liveContext}\n\n${stage2Analysis}\n\n${stage3Access}\n\n${stage4Rush}\n\n${stage5Recommendations}\n\n${stage6Reliability}`);
    const userContent: any = imageDataUrl ? [{ type: "text", text: question || "Please analyze this image in the context of my Garrison Market store." }, { type: "image_url", image_url: { url: imageDataUrl } }] : question;
    const messages: any[] = [{ role: "system", content: system }, ...history.slice(-8, -1), { role: "user", content: userContent }];
    const ai = await askOpenRouter(messages); if (!ai.reply) return NextResponse.json({ success: false, error: ai.error || "Ask Me could not produce an answer." }, { status: 502 });
    return NextResponse.json({ success: true, reply: ai.reply, products: [] });
  } catch (error) { console.error("ASK_ME_ROUTE_ERROR", error); return NextResponse.json({ success: false, error: "Ask Me encountered a server error. Please try again." }, { status: 500 }); }
}
