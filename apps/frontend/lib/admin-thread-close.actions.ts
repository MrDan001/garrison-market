"use server";
// FILE: apps/frontend/lib/admin-thread-close.actions.ts

import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ Set this in your Vercel env vars once you have the review link:
// GOOGLE_REVIEW_URL=https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || "";

// ⚠️ Adjust to whatever "from" address you already use elsewhere for
// admin/support emails (e.g. the same one sendAdminReplyAction uses).
const FROM_EMAIL = process.env.ADMIN_MESSAGE_FROM_EMAIL || "Garrison Market <support@gmstock.coisonmarket.com>";

export async function getThreadStatusAction(messageId: number, ownerId: number): Promise<"open" | "closed"> {
  const row = await prisma.adminMessageThreadStatus.findUnique({
    where: { messageId_ownerId: { messageId, ownerId } },
    select: { status: true },
  });
  return (row?.status as "open" | "closed") || "open";
}

export async function closeThreadAction(messageId: number, ownerId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Unauthorized." };
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true, fullName: true },
  });
  if (!owner) {
    return { success: false, error: "Owner not found." };
  }

  await prisma.adminMessageThreadStatus.upsert({
    where: { messageId_ownerId: { messageId, ownerId } },
    update: { status: "closed", closedAt: new Date(), closedBy: session.email || "admin" },
    create: {
      messageId,
      ownerId,
      status: "closed",
      closedAt: new Date(),
      closedBy: session.email || "admin",
    },
  });

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: owner.email,
      subject: "Your conversation has been closed",
      html: `
        <div style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
          <p>Hi ${owner.fullName || "there"},</p>
          <p>Your conversation with the Garrison Market support team has been marked as resolved and closed. If you need anything else, feel free to reach out again anytime.</p>
          ${
            GOOGLE_REVIEW_URL
              ? `
          <p>If you have a moment, we'd really appreciate a quick review — it helps us a lot:</p>
          <p>
            <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
              ⭐ Rate us on Google
            </a>
          </p>`
              : ""
          }
          <p>Thank you for using Garrison Market!</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[close-thread] Failed to send closing email:", err);
    // Don't fail the whole action just because the email didn't send —
    // the ticket is still closed either way.
  }

  return { success: true };
}