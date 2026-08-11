// FILE: apps/frontend/lib/rush-clock.actions.ts (NEW FILE — Fix A)
//
// Clock-in/clock-out for staff. This is the real trigger behind the
// STAFF_ON_TIME XP award, which previously existed in XP_AMOUNTS but was
// never wired to anything.
//
// "On time" = clocked in at or before the store's shiftStartTime (owner-
// configurable, defaults to "08:00"), compared using server local wall-
// clock time — the same untyped-timezone assumption every other daily
// reset in this codebase already makes (see startOfToday() patterns in
// rush-quests.actions.ts, rush-streak-reset.ts, etc.). If the server's
// timezone ever changes, all of these need revisiting together, not just
// this file.
//
// Same fail-soft contract as the rest of the Rush actions: never throw
// into a page render or click handler.

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { getActiveStoreId } from "./store-context";
import { awardXp } from "./rush.actions";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Parses "HH:mm" against today's date to get a comparable Date.
function shiftStartAsToday(shiftStartTime: string): Date {
  const [hoursStr, minutesStr] = shiftStartTime.split(":");
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  const today = startOfToday();
  today.setHours(hours, minutes, 0, 0);
  return today;
}

// --- Status read ------------------------------------------------------------

export type ClockStatus = {
  clockedIn: boolean;
  clockInAt: Date | null;
  onTime: boolean | null;
  clockedOut: boolean;
  clockOutAt: Date | null;
  shiftStartTime: string;
};

export async function getTodayClockStatus(): Promise<ClockStatus | null> {
  try {
    const session = await getSessionUser();
    if (!session) return null;

    const storeId = await getActiveStoreId();
    if (!storeId) return null;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shiftStartTime: true },
    });
    if (!store) return null;

    const clockDate = startOfToday();
    const event = await prisma.clockEvent.findUnique({
      where: { userId_storeId_clockDate: { userId: session.id, storeId, clockDate } },
    });

    if (!event) {
      return {
        clockedIn: false,
        clockInAt: null,
        onTime: null,
        clockedOut: false,
        clockOutAt: null,
        shiftStartTime: store.shiftStartTime,
      };
    }

    return {
      clockedIn: true,
      clockInAt: event.clockInAt,
      onTime: event.onTime,
      clockedOut: !!event.clockOutAt,
      clockOutAt: event.clockOutAt,
      shiftStartTime: store.shiftStartTime,
    };
  } catch (error) {
    console.error("getTodayClockStatus failed:", error);
    return null;
  }
}

// --- Clock in -----------------------------------------------------------

export async function clockIn(): Promise<{ success: boolean; onTime?: boolean; alreadyClockedIn?: boolean }> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "staff") return { success: false };

    const storeId = await getActiveStoreId();
    if (!storeId) return { success: false };

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shiftStartTime: true },
    });
    if (!store) return { success: false };

    const clockDate = startOfToday();
    const now = new Date();

    const existing = await prisma.clockEvent.findUnique({
      where: { userId_storeId_clockDate: { userId: session.id, storeId, clockDate } },
    });
    if (existing) {
      return { success: true, onTime: existing.onTime, alreadyClockedIn: true };
    }

    const onTime = now <= shiftStartAsToday(store.shiftStartTime);

    await prisma.clockEvent.create({
      data: { userId: session.id, storeId, clockDate, clockInAt: now, onTime },
    });

    if (onTime) {
      await awardXp(session.id, storeId, "STAFF_ON_TIME", { clockDate: clockDate.toISOString() });
    }

    revalidatePath("/staff/rush");
    revalidatePath("/staff/dashboard");

    return { success: true, onTime, alreadyClockedIn: false };
  } catch (error) {
    console.error("clockIn failed:", error);
    return { success: false };
  }
}

// --- Clock out ----------------------------------------------------------

export async function clockOut(): Promise<{ success: boolean }> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "staff") return { success: false };

    const storeId = await getActiveStoreId();
    if (!storeId) return { success: false };

    const clockDate = startOfToday();

    const existing = await prisma.clockEvent.findUnique({
      where: { userId_storeId_clockDate: { userId: session.id, storeId, clockDate } },
    });
    // Nothing to close out — either never clocked in today, or already
    // clocked out (idempotent no-op rather than an error either way).
    if (!existing || existing.clockOutAt) return { success: false };

    await prisma.clockEvent.update({
      where: { id: existing.id },
      data: { clockOutAt: new Date() },
    });

    revalidatePath("/staff/rush");
    revalidatePath("/staff/dashboard");

    return { success: true };
  } catch (error) {
    console.error("clockOut failed:", error);
    return { success: false };
  }
}

// --- Owner: reading the current setting (for the settings card's initial value) ---

export async function getShiftStartTime(): Promise<string> {
  try {
    const storeId = await getActiveStoreId();
    if (!storeId) return "08:00";

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shiftStartTime: true },
    });
    return store?.shiftStartTime ?? "08:00";
  } catch (error) {
    console.error("getShiftStartTime failed:", error);
    return "08:00";
  }
}

// --- Owner: shift start time setting -------------------------------------

const SHIFT_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function setShiftStartTime(newTime: string): Promise<{ success: boolean }> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "owner") return { success: false };

    if (!SHIFT_TIME_PATTERN.test(newTime)) return { success: false };

    const storeId = await getActiveStoreId();
    if (!storeId) return { success: false };

    // Defense-in-depth: re-verify the active store actually belongs to
    // this owner before writing, same pattern used in store-context.ts.
    const owned = await prisma.store.findFirst({
      where: { id: storeId, ownerId: session.id },
      select: { id: true },
    });
    if (!owned) return { success: false };

    await prisma.store.update({
      where: { id: storeId },
      data: { shiftStartTime: newTime },
    });

    revalidatePath("/owner/rush");

    return { success: true };
  } catch (error) {
    console.error("setShiftStartTime failed:", error);
    return { success: false };
  }
}