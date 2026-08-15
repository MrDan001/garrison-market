// FILE: apps/frontend/app/ref/[code]/route.ts
//
// The actual gmstock.co/ref/DANIEL001 link affiliates share. Logs an
// AffiliateClick, drops a 30-day attribution cookie, then sends the
// visitor on to registration — or, while the Stage 2 registration gate
// is closed (100-day waitlist), straight to /waitlist with the code
// attached via ?ref= so it's captured as the referrer immediately,
// instead of bouncing through /register and losing it. Unknown/inactive
// codes still just send the visitor onward with no cookie set — a bad
// code should never dead-end the visitor.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AFFILIATE_COOKIE_NAME } from "@/lib/affiliate-constants";
import { isRegistrationOpen } from "@/lib/system-settings.actions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const baseUrl = request.nextUrl.origin;
  const registrationOpen = await isRegistrationOpen();
  // /register itself would redirect to /waitlist anyway when closed
  // (Stage 2), but going there directly with the code attached means
  // the waitlist signup is correctly attributed to this affiliate from
  // the start, instead of losing the code across two redirects.
  const registerUrl = registrationOpen ? `${baseUrl}/register` : `${baseUrl}/waitlist?ref=${cleanCode}`;

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode: cleanCode },
      select: { id: true, status: true },
    });

    if (!affiliate || affiliate.status === "suspended") {
      return NextResponse.redirect(registrationOpen ? `${baseUrl}/register` : `${baseUrl}/waitlist`);
    }

    const click = await prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        userAgent: request.headers.get("user-agent") || null,
        // IP is hashed, not stored raw — this is only ever used to eyeball
        // click patterns, never to identify a visitor.
        ipHash: hashIp(request.headers.get("x-forwarded-for") || ""),
      },
    });

    const response = NextResponse.redirect(registerUrl);
    response.cookies.set(AFFILIATE_COOKIE_NAME, `${cleanCode}:${click.id}`, {
      // Not httpOnly: this is just a referral code + click id, nothing
      // sensitive, and the register page's client component reads it
      // client-side to show the "Referred by affiliate" badge. Server
      // actions still read it independently via cookies() for the real
      // attribution logic — this flag only controls JS access.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days — the link-expiry rule
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Affiliate click tracking error:", error);
    return NextResponse.redirect(registerUrl);
  }
}

function hashIp(ip: string): string | null {
  if (!ip) return null;
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}