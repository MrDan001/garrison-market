// FILE: apps/frontend/lib/waitlist-internal.ts (NEW FILE)
//
// Stage 7 of the 100-day waitlist. Called exclusively from
// registerOwnerAction (lib/auth.actions.ts) — never from client UI —
// which is why this file deliberately has NO "use server" directive,
// same reasoning as affiliate-internal.ts: a file-level "use server"
// directive would make every export here a public, directly-invokable
// Server Action regardless of intent, and markWaitlistSignupRegistered
// in particular writes data (marks a row "registered" against an
// arbitrary ownerId) that must never be reachable except from the
// registration flow itself.
//
// WHY THIS FILE EXISTS AT ALL: the invite email sent by
// releaseWaitlistAction (lib/waitlist.actions.ts) links to plain
// /register with no ?ref= or code attached. By the time someone
// actually clicks through and registers — days or weeks after joining
// the waitlist, on a possibly different device/browser — the original
// referral cookie has almost certainly expired or never existed on
// that device, and nobody manually retypes a code they gave weeks
// ago. Without this bridge, every single referral captured back at
// waitlist-signup time would silently evaporate the moment someone
// actually registers, and referrers would never get credited for
// people who came through the waitlist. This looks the new
// registrant's email up against their original WaitlistSignup row and
// feeds its stored referredByCode back into the exact same resolution
// paths a normal, non-waitlist registration already uses.

import prisma from "@/lib/prisma";

export async function resolveWaitlistAttributionByEmail(email: string): Promise<{
  waitlistSignupId: number;
  referredByCode: string | null;
  referredByType: string | null;
} | null> {
  const signup = await prisma.waitlistSignup.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, referredByCode: true, referredByType: true },
  });
  if (!signup) return null;
  return {
    waitlistSignupId: signup.id,
    referredByCode: signup.referredByCode,
    referredByType: signup.referredByType,
  };
}

export async function markWaitlistSignupRegistered(waitlistSignupId: number, ownerId: number) {
  try {
    await prisma.waitlistSignup.update({
      where: { id: waitlistSignupId },
      data: { status: "registered", registeredOwnerId: ownerId },
    });
  } catch (error) {
    // Best-effort bookkeeping — must never block a real registration
    // from completing.
    console.error("markWaitlistSignupRegistered failed:", error);
  }
}