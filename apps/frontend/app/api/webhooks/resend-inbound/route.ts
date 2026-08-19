import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { createAdminNotification } from "@/lib/admin-notification.actions";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

function parseReplyAddress(address: string): { messageId: number; ownerId: number } | null {
  const match = address.match(/reply\+msg(\d+)-owner(\d+)@/);
  if (!match) return null;
  const messageId = parseInt(match[1], 10);
  const ownerId = parseInt(match[2], 10);
  if (!Number.isFinite(messageId) || !Number.isFinite(ownerId)) return null;
  return { messageId, ownerId };
}

// SECURITY: reply+msgN-ownerM@ addresses are guessable (small sequential
// integers), and the Svix signature only proves the request came from
// Resend — it says nothing about who the *email* was actually from. This
// extracts a clean, lowercased address from whatever shape Resend hands
// back (a bare address, or "Display Name <address>") so it can be checked
// against the owner's own registered email before a reply is ever
// attributed to them.
function extractEmailAddress(raw: unknown): string | null {
  if (!raw) return null;
  const str = typeof raw === "string" ? raw : (raw as { address?: string })?.address;
  if (!str) return null;
  const angleMatch = str.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : str).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

function stripQuotedReply(text: string): string {
  let result = text.replace(/\r\n/g, "\n");

  const cutMarkers: RegExp[] = [
    /\n\s*On .+ wrote:[\s\S]*$/,
    /\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i,
    /\nFrom:\s.+\nSent:\s.+\nTo:\s.+\nSubject:\s[\s\S]*$/i,
    /\n>[^\n]*(\n>[^\n]*)*\s*$/,
  ];

  for (const marker of cutMarkers) {
    const match = result.match(marker);
    if (match && match.index !== undefined) {
      result = result.slice(0, match.index);
    }
  }

  return result.trim();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let event: any;
  try {
    const resend = getResendClient();
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET || "",
    });
  } catch (err) {
    console.error("[resend-inbound] Invalid webhook signature or missing Resend API key:", err);
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  if (event?.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  try {
    const resend = getResendClient();
    const toList: string[] = Array.isArray(event.data?.to)
      ? event.data.to
      : [event.data?.to].filter(Boolean);
    const toAddress = toList.find((addr: string) => addr.includes("reply+msg")) || toList[0] || "";
    const parsed = parseReplyAddress(toAddress);

    if (!parsed) {
      console.warn(`[resend-inbound] Received email with unparseable recipient: "${toAddress}"`);
      return NextResponse.json({ received: true });
    }

    const { messageId, ownerId } = parsed;

    // 1. Verify Message and User exist without strict role case mismatch
    const [message, owner] = await Promise.all([
      prisma.adminMessage.findFirst({
        where: {
          id: messageId,
          OR: [{ audience: "all_owners" }, { targetOwnerId: ownerId }],
        },
        select: { id: true, subject: true },
      }),
      prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true, fullName: true, storeName: true, email: true } }),
    ]);

    if (!message || !owner) {
      console.error(
        `[resend-inbound] Thread validation failed: Message #${messageId} or Owner #${ownerId} not found.`
      );
      return NextResponse.json({ received: true });
    }

    // SECURITY: the recipient address only tells us which thread this
    // *claims* to belong to — it's guessable, and Svix only authenticates
    // Resend as the transport, not the original sender. Without this check,
    // anyone who emails a guessed reply+msgN-ownerM@ address gets their
    // message recorded and shown to the admin as if it came from that
    // owner. Reject (rather than silently attribute) anything that doesn't
    // match the owner's own registered email.
    const senderAddress = extractEmailAddress(event.data?.from);
    if (!owner.email || !senderAddress || senderAddress !== owner.email.trim().toLowerCase()) {
      console.warn(
        `[resend-inbound] Sender mismatch on Message #${messageId}, Owner #${ownerId}: got "${senderAddress ?? "unknown"}", expected the registered owner email. Dropping.`
      );
      return NextResponse.json({ received: true });
    }

    // 1b. Reject replies on a closed thread — the ticket has been closed
    // by an admin, so no new replies should be recorded.
    const threadStatus = await prisma.adminMessageThreadStatus.findUnique({
      where: { messageId_ownerId: { messageId, ownerId } },
      select: { status: true },
    });
    if (threadStatus?.status === "closed") {
      console.log(`[resend-inbound] Ignored reply on closed thread — Message #${messageId}, Owner #${ownerId}.`);
      return NextResponse.json({ received: true });
    }

    // 2. Fetch full email content via the Receiving API (webhook payload only has metadata —
    // body content must be fetched separately using resend.emails.receiving.get, NOT resend.emails.get,
    // which is for sent emails)
    const emailId = event.data?.email_id;
    let fullEmail: any = null;

    try {
      const res = await resend.emails.receiving.get(emailId);
      fullEmail = res.data;
    } catch (sdkErr) {
      console.error(`[resend-inbound] Failed to fetch email #${emailId} via Receiving API:`, sdkErr);
      return NextResponse.json({ received: true });
    }

    const rawText: string =
      fullEmail?.text || (fullEmail?.html ? fullEmail.html.replace(/<[^>]+>/g, " ") : "") || "";
    const body = stripQuotedReply(rawText);

    if (!body) {
      console.warn(`[resend-inbound] Stripped body was empty for email #${emailId}. Raw length: ${rawText.length}`);
      return NextResponse.json({ received: true });
    }

    // 3. Create the database record
    const createdReply = await prisma.adminMessageReply.create({
      data: { messageId, ownerId, authorRole: "owner", body },
    });

    console.log(`[resend-inbound] Successfully created reply #${createdReply.id} for Message #${messageId}`);

    // Wrapped so a failure here can never turn a successfully-recorded
    // reply into a webhook error (Resend would just retry delivery).
    try {
      await createAdminNotification({
        type: "email_awaiting_reply",
        message: `${owner?.fullName || owner?.storeName || "An owner"} replied by email to "${message?.subject}" and is awaiting a response.`,
        link: `/admin/messages/${messageId}`,
      });
    } catch (notifyErr) {
      console.error("[resend-inbound] admin notification failed", notifyErr);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[resend-inbound] Unhandled processing error:", error);
    return NextResponse.json({ received: true });
  }
}
