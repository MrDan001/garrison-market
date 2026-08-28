"use server";

import { headers } from "next/headers";

export type AskMeChatMessage = { role: "user" | "assistant"; content: string };
export type AskMeProduct = { id: number; name: string; image: string | null; price: number; unitsSold: number };
export type AskMeGeneratedImage = { url: string; prompt: string };

function originFromHeaders(h: Headers): string {
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  throw new Error("Unable to determine application URL");
}

export async function askStoreAssistant(history: AskMeChatMessage[], imageDataUrl?: string) {
  try {
    const h = await headers();
    const cookie = h.get("cookie");

    // This is a server-to-server fetch. Next.js does not automatically forward
    // the browser's session cookies when a Server Action fetches our own API.
    // Forward the current session so /api/ask-me can authenticate the same
    // owner/staff session and enforce the store/security boundary.
    const requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) requestHeaders.Cookie = cookie;

    const response = await fetch(`${originFromHeaders(h)}/api/ask-me`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ history, imageDataUrl }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (data?.success) {
      return {
        success: true as const,
        reply: String(data.reply ?? ""),
        products: Array.isArray(data.products) ? data.products as AskMeProduct[] : [],
        generatedImage: data.generatedImage as AskMeGeneratedImage | undefined,
      };
    }

    return {
      success: false as const,
      error: String(data?.error ?? "Ask Me could not complete that request. Please try again."),
    };
  } catch (error) {
    console.error("askStoreAssistant API client error", error);
    return { success: false as const, error: "Ask Me could not reach the AI service. Please try again." };
  }
}
