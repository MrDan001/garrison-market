import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

// Handles Resend's `email.received` webhook — fired whenever an owner
// replies (via Gmail, Outlook, etc.) to an admin broadcast email. The
// broadcast's Reply-To was set to a unique address per (messageId, ownerId)
// (see lib/email.ts -> getAdminMessageReplyAddress), so we parse that back
// out, fetch the actual body (webhook payloads are metadata-only), strip
// quoted history, and save it as an AdminMessageReply — same thread the
// admin sees and replies to from inside the app.
//
// This route only ever creates authorRole: "owner" replies. Admin's side of
// the conversation is sent from inside the app (see Stage 5), not by email.

const resend = new Resend(process.env.RESEND_API_KEY);

function parseReplyAddress(address: string): { messageId: number; ownerId: number } | null {
  // Matches both bare "reply+msg123-owner45@domain" and the
  // "Name <reply+msg123-owner45@domain>" form some clients send.
  const match = address.match(/reply\+msg(\d+)-owner(\d+)@/);
  if (!match) return null;
  const messageId = parseInt(match[1], 10);
  const ownerId = parseInt(match[2], 10);
  if (!Number.isFinite(messageId) || !Number.isFinite(ownerId)) return null;
  return { messageId, ownerId };
}

// Cuts off quoted history so only the new reply text is stored — covers
// Gmail's "On ... wrote:" block, Outlook's "From:/Sent:/To:/Subject:"
// block, "----- Original Message -----" dividers, and "> " quote lines.
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
  // Signature verification needs the raw, untouched body.
  const rawBody = await request.text();

  let event: any;
  try {
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
    console.error("[resend-inbound] Invalid webhook signature.", err);
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  if (event?.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  try {
    const toList: string[] = Array.isArray(event.data?.to)
      ? event.data.to
      : [event.data?.to].filter(Boolean);
    const toAddress = toList.find((addr: string) => addr.includes("reply+msg")) || toList[0] || "";
    const parsed = parseReplyAddress(toAddress);

    if (!parsed) {
      // Not one of our threaded reply addresses — ignore silently.
      return NextResponse.json({ received: true });
    }

    const { messageId, ownerId } = parsed;

    // Confirm this owner is actually a real recipient of this message
    // before writing anything, so a forged or stale address can't create
    // a reply row that doesn't belong to a real thread.
    const [message, owner] = await Promise.all([
      prisma.adminMessage.findFirst({
        where: {
          id: messageId,
          OR: [{ audience: "all_owners" }, { targetOwnerId: ownerId }],
        },
        select: { id: true },
      }),
      prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true } }),
    ]);

    if (!message || !owner || owner.role !== "owner") {
      console.error(
        `[resend-inbound] No matching thread for message ${messageId} / owner ${ownerId}.`
      );
      return NextResponse.json({ received: true });
    }

    // The webhook payload itself only has metadata — fetch the real body.
    const { data: fullEmail } = await resend.emails.receiving.get(event.data.email_id);
    const rawText: string =
      fullEmail?.text || (fullEmail?.html ? fullEmail.html.replace(/<[^>]+>/g, " ") : "") || "";
    const body = stripQuotedReply(rawText);

    if (!body) {
        return NextResponse.json({ received: true }); // silently drops it, no console.log
      }

    await prisma.adminMessageReply.create({
      data: { messageId, ownerId, authorRole: "owner", body },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Always 200 back to Resend once the signature is valid, so it doesn't
    // treat a downstream hiccup as a delivery failure and retry forever.
    console.error("[resend-inbound] Processing error:", error);
    return NextResponse.json({ received: true });
  }
}