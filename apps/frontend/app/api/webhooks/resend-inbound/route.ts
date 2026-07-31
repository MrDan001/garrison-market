import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

function parseReplyAddress(address: string): { messageId: number; ownerId: number } | null {
  const match = address.match(/reply\+msg(\d+)-owner(\d+)@/);
  if (!match) return null;
  const messageId = parseInt(match[1], 10);
  const ownerId = parseInt(match[2], 10);
  if (!Number.isFinite(messageId) || !Number.isFinite(ownerId)) return null;
  return { messageId, ownerId };
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
    console.error("[resend-inbound] Invalid webhook signature:", err);
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
        select: { id: true },
      }),
      prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true } }),
    ]);

    if (!message || !owner) {
      console.error(
        `[resend-inbound] Thread validation failed: Message #${messageId} or Owner #${ownerId} not found.`
      );
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
      // Temporary diagnostic — dump the full raw response so we can see its real shape.
      // Remove this line once the body extraction is confirmed working.
      console.log("[resend-inbound] full receiving.get() response:", JSON.stringify(res, null, 2));
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

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[resend-inbound] Unhandled processing error:", error);
    return NextResponse.json({ received: true });
  }
}