// FILE: apps/frontend/lib/system-settings.actions.ts (NEW FILE)
//
// Stage 2 of the 100-day waitlist. getSystemSettings() is the one place
// that reads/creates the single settings row; everything else in this
// file is a thin wrapper around it.
//
// toggleRegistrationGateAction() is admin-only and exists here now so
// Stage 2's gate logic is fully functional on its own — Stage 5 (the
// admin panel) just adds a button that calls this, it doesn't need any
// new logic of its own. Flipping the gate never sends an email or
// touches the waitlist table at all — see lib/waitlist-release.actions.ts
// in a later stage for the deliberately separate "release" action.

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { revalidatePath } from "next/cache";

export async function getSystemSettings() {
  const existing = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  // First-ever read: create the single row with schema defaults. Safe
  // to race — upsert handles two requests hitting this at once.
  return prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function isRegistrationOpen(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.registrationOpen;
}

export async function toggleRegistrationGateAction(open: boolean) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return { error: "Unauthorized" };
  }

  try {
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: { registrationOpen: open },
      create: { id: 1, registrationOpen: open },
    });

    // /register, / (homepage CTAs), and /login (register link) all
    // render based on this flag. Each is now marked force-dynamic so
    // they read fresh on every request regardless, but revalidating
    // here too means a flip takes effect immediately rather than
    // waiting on the next natural request cycle.
    revalidatePath("/register");
    revalidatePath("/");
    revalidatePath("/login");

    return { success: true };
  } catch (error) {
    console.error("toggleRegistrationGateAction error:", error);
    return { error: "Could not update the registration gate." };
  }
}
