// FILE: apps/frontend/lib/store-assistant.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveStoreId } from "@/lib/store-context";
import { OWNER_IDENTITY, STAFF_IDENTITY, OWNER_KNOWLEDGE, STAFF_KNOWLEDGE } from "@/lib/store-assistant-knowledge";

/**
 * "Ask Me" — the in-app AI assistant. Runs on Groq's free tier
 * (https://console.groq.com), not Anthropic — chosen specifically because
 * it requires no card on file and stays free at this app's expected volume.
 * It's OpenAI-compatible, so this is a plain fetch, no SDK dependency needed.
 *
 * SETUP REQUIRED: add to apps/frontend/.env
 *   GROQ_API_KEY=gsk_...
 * (Sign up at console.groq.com → API Keys → Create Key. No credit card.)
 * Until that's set, askStoreAssistant() returns a friendly "not configured
 * yet" message instead of erroring, so the UI never crashes for lack of it.
 */

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Keep the request small and bounded — this is a help widget, not an open
// chat: cap how much history we forward and how long any single message
// can be, so one long-winded exchange can't balloon token usage per call.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;

// ── Rate limiting ──────────────────────────────────────────────────────
// Basic per-user sliding window so one person (or a script) can't hammer
// the Groq API and burn through the free-tier quota for everyone else.
// In-memory is enough here: this is a single-instance app, and a help
// widget doesn't need durability across restarts — worst case someone
// gets a couple of extra requests right after a deploy.
const RATE_LIMIT_MAX_REQUESTS = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;

const requestLog = new Map<number, number[]>();

function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(userId, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return false;
}

export type AskMeChatMessage = { role: "user" | "assistant"; content: string };

// A product card the UI can render with a real image, pulled straight from
// Inventory — the model never invents or links to images itself, it only
// gets told (in text) which products are on this list and their price.
export type AskMeProduct = {
  id: number;
  name: string;
  image: string | null;
  price: number;
  unitsSold: number;
};

const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

// ── Best-selling products ──────────────────────────────────────────────
// Unlike the owner-only sales/staff-performance data, this is available to
// BOTH roles — it's the same kind of info anyone can already see browsing
// Inventory, just summarized. Only fetched when the question actually
// looks like a product question, to avoid an unnecessary DB round trip on
// every single message.
const PRODUCT_QUERY_KEYWORDS = [
  "best sell", "best-sell", "bestsell", "top product", "top seller",
  "top-selling", "top selling", "most sold", "most popular",
  "highest selling", "highest-selling", "which product", "popular product",
  "best product", "product image", "show me the product",
];

function isProductQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return PRODUCT_QUERY_KEYWORDS.some((kw) => lower.includes(kw));
}

async function getBestSellingProducts(ownerId: number, storeId: number | null): Promise<AskMeProduct[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        ownerId,
        date: { gte: since },
        ...(storeId ? { OR: [{ storeId }, { storeId: null }] } : {}),
      },
    },
    select: { inventoryId: true, quantity: true },
  });

  if (orderItems.length === 0) return [];

  const unitsByInventoryId = new Map<number, number>();
  for (const item of orderItems) {
    unitsByInventoryId.set(item.inventoryId, (unitsByInventoryId.get(item.inventoryId) ?? 0) + item.quantity);
  }

  const topIds = [...unitsByInventoryId.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const inventoryRows = await prisma.inventory.findMany({
    where: { id: { in: topIds }, ownerId },
    select: { id: true, name: true, image: true, price: true },
  });

  return topIds
    .map((id) => {
      const inv = inventoryRows.find((r) => r.id === id);
      if (!inv) return null;
      return {
        id: inv.id,
        name: inv.name,
        image: inv.image,
        price: Number(inv.price),
        unitsSold: unitsByInventoryId.get(id) ?? 0,
      };
    })
    .filter((p): p is AskMeProduct => p !== null);
}

// ── Owner live data ────────────────────────────────────────────────────
// Business/staff-performance questions are only ever answered from real
// numbers pulled fresh at request time — never from the model's memory or
// guesswork. Staff never get this function called on their behalf; it's
// only wired in for session.role === "owner" below.
async function getOwnerLiveDataSnapshot(ownerId: number): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [staff, weekByStaff, weekTotal, prevWeekTotal] = await Promise.all([
    prisma.user.findMany({
      where: { ownerId, role: "staff" },
      select: { id: true, fullName: true, status: true },
    }),
    prisma.order.groupBy({
      by: ["staffId"],
      where: { ownerId, staffId: { not: null }, date: { gte: weekAgo } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { ownerId, date: { gte: weekAgo } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { ownerId, date: { gte: twoWeeksAgo, lt: weekAgo } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  if (staff.length === 0) {
    return `## Live store data (as of ${now.toDateString()})\nNo staff registered yet, so there's no per-staff performance to report. Overall store sales this week: ${NAIRA.format(Number(weekTotal._sum.total ?? 0))} across ${weekTotal._count} sale(s).`;
  }

  const salesByStaffId = new Map(weekByStaff.map((row) => [row.staffId as number, row]));

  const ranked = staff
    .map((s) => {
      const row = salesByStaffId.get(s.id);
      return {
        name: s.fullName ?? `Staff #${s.id}`,
        status: s.status,
        total: Number(row?._sum.total ?? 0),
        count: row?._count ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const thisWeek = Number(weekTotal._sum.total ?? 0);
  const lastWeek = Number(prevWeekTotal._sum.total ?? 0);
  const trend =
    lastWeek === 0
      ? "no prior-week data to compare"
      : `${thisWeek >= lastWeek ? "up" : "down"} ${Math.abs(Math.round(((thisWeek - lastWeek) / lastWeek) * 100))}% from last week's ${NAIRA.format(lastWeek)}`;

  const staffLines = ranked
    .map((s, i) => {
      const tag = i === 0 && s.total > 0 ? " (top performer this week)" : "";
      const lowTag = i === ranked.length - 1 && ranked.length > 1 ? " (lowest this week)" : "";
      const inactiveTag = s.status !== "active" ? ` [status: ${s.status}]` : "";
      return `${i + 1}. ${s.name}${inactiveTag} — ${NAIRA.format(s.total)} across ${s.count} sale(s)${tag}${lowTag}`;
    })
    .join("\n");

  return `## Live store data (last 7 days, as of ${now.toDateString()})
Total store sales this week: ${NAIRA.format(thisWeek)} across ${weekTotal._count} sale(s) — ${trend}.

Staff performance this week, sorted highest to lowest:
${staffLines}

These are the ONLY figures you have access to — this week's totals per staff plus the store-wide week-over-week trend. You do not have monthly, yearly, or per-item breakdowns, staff wages/salaries, or profit margins; if asked for those, say you don't have that figure here and point to Reports (/owner/report) or History (/owner/history).`;
}

export async function askStoreAssistant(history: AskMeChatMessage[]) {
  const session = await getSessionUser();
  if (!session || (session.role !== "owner" && session.role !== "staff")) {
    return { success: false as const, error: "Unauthorized" };
  }

  if (isRateLimited(session.id)) {
    return {
      success: false as const,
      error: "You're sending questions a bit fast — give it a few seconds and try again.",
    };
  }

  if (!process.env.GROQ_API_KEY) {
    return {
      success: false as const,
      error:
        "Ask Me isn't set up yet — an admin needs to add a Groq API key before this assistant can answer questions.",
    };
  }

  if (!Array.isArray(history) || history.length === 0) {
    return { success: false as const, error: "No question provided." };
  }

  const identity = session.role === "owner" ? OWNER_IDENTITY : STAFF_IDENTITY;
  const knowledge = session.role === "owner" ? OWNER_KNOWLEDGE : STAFF_KNOWLEDGE;
  let systemPrompt = `${identity}\n\n# Knowledge base (${session.role})\n${knowledge}`;

  // Only owners get live business/staff-performance data injected — staff
  // never see this, by design (their identity prompt also refuses to
  // discuss it even if asked, but not injecting it at all is the real
  // guardrail: the model can't leak numbers it was never given).
  if (session.role === "owner") {
    try {
      const liveData = await getOwnerLiveDataSnapshot(session.id);
      systemPrompt += `\n\n${liveData}`;
    } catch (error) {
      console.error("getOwnerLiveDataSnapshot error:", error);
      systemPrompt += `\n\n## Live store data\nUnavailable right now — if asked about sales or staff performance, say the live figures couldn't be loaded and suggest checking Reports (/owner/report) instead.`;
    }
  }

  // Best-selling products — available to BOTH roles, only fetched when the
  // question actually looks like a product question (keyword check) so we
  // don't hit the DB on every single message.
  let products: AskMeProduct[] = [];
  const latestUserMessage = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  if (isProductQuery(latestUserMessage)) {
    const ownerIdForProducts = session.role === "owner" ? session.id : session.ownerId;

    if (!ownerIdForProducts) {
      systemPrompt += `\n\n## Top-selling products\nUnavailable — this account isn't linked to a store owner. Say you can't look up products right now.`;
    } else {
      try {
        const storeId = await getActiveStoreId();
        products = await getBestSellingProducts(ownerIdForProducts, storeId);

        if (products.length > 0) {
          const productLines = products
            .map((p, i) => `${i + 1}. ${p.name} — ${NAIRA.format(p.price)} — ${p.unitsSold} sold in the last 30 days`)
            .join("\n");
          systemPrompt += `\n\n## Top-selling products (last 30 days)\n${productLines}\n\nWhen asked about best-selling, popular, or top products, use ONLY this list — name and price exactly as given, ranked highest to lowest by units sold. Don't describe, invent, or link to a product image yourself — the app already shows the real product image next to your answer, so just mention the product by name.`;
        } else {
          systemPrompt += `\n\n## Top-selling products (last 30 days)\nNo product sales recorded in the last 30 days for this store. Say so plainly if asked.`;
        }
      } catch (error) {
        console.error("getBestSellingProducts error:", error);
        systemPrompt += `\n\n## Top-selling products\nUnavailable right now — say the product data couldn't be loaded.`;
      }
    }
  }

  // Trim to the last N messages and clamp each message's length — keeps
  // the request bounded regardless of how long the chat has run.
  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...trimmedHistory],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Groq API error:", res.status, errText);
      return {
        success: false as const,
        error: "Ask Me is temporarily unavailable — please try again in a moment, or use Support instead.",
      };
    }

    const data = await res.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return {
        success: false as const,
        error: "Ask Me didn't return an answer — please try rephrasing your question.",
      };
    }

    return { success: true as const, reply: reply.trim(), products };
  } catch (error) {
    console.error("askStoreAssistant error:", error);
    return {
      success: false as const,
      error: "Ask Me is temporarily unavailable — please try again in a moment, or use Support instead.",
    };
  }
}