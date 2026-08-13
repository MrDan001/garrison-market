// FILE: apps/frontend/lib/rush-clock.actions.ts (UPDATED — fixes a status-filter bug in getApprovedStoreStaff/getStaffClockRoster/getStaffClockRosterRange: staff accounts use status "active"/"suspended", never "approved", so the roster always came back empty. Renamed the helper to getActiveStoreStaff to match reality. Also adds getStaffClockRosterRange(days), a rolled-up attendance summary that powers the "7 Days" tab on StaffClockRosterCard. Takes a plain day count so a future 30/90-day view needs no new query. getStaffClockRoster() below is otherwise unchanged. Clock-in/clock-out logic further below is unchanged from Fix A.)
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

// --- Owner: today's clock roster across all staff ------------------------
//
// getTodayClockStatus() above only ever answers "is the logged-in person
// clocked in" — there was previously no query that fans that out across a
// whole store. This is that query: every active staff member assigned to
// the active store, joined against today's ClockEvent (if any). Staff
// who haven't clocked in yet still appear, with clockedIn: false, so the
// owner sees absences, not just a partial list.
//
// Status filter is "active", not "approved" — staff accounts don't go
// through an approval step in this app. The owner creates them directly
// in registerStaffAction() with status: "active", and toggleStaffStatus()
// only ever flips between "active" and "suspended". "approved" isn't a
// status a staff row can have, so filtering on it always returned zero
// rows.

async function getActiveStoreStaff(storeId: number) {
  return prisma.user.findMany({
    where: { staffStoreId: storeId, role: "staff", status: "active" },
    select: { id: true, fullName: true },
  });
}

export type StaffClockRosterEntry = {
  userId: number;
  name: string;
  clockedIn: boolean;
  clockInAt: Date | null;
  onTime: boolean | null;
  clockedOut: boolean;
  clockOutAt: Date | null;
};

export async function getStaffClockRoster(): Promise<StaffClockRosterEntry[]> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "owner") return [];

    const storeId = await getActiveStoreId();
    if (!storeId) return [];

    const clockDate = startOfToday();

    const [staff, events] = await Promise.all([
      getActiveStoreStaff(storeId),
      prisma.clockEvent.findMany({
        where: { storeId, clockDate },
      }),
    ]);
    if (staff.length === 0) return [];

    const eventByUserId = new Map(events.map((e) => [e.userId, e]));

    const roster: StaffClockRosterEntry[] = staff.map((s) => {
      const event = eventByUserId.get(s.id);
      return {
        userId: s.id,
        name: s.fullName || "Team member",
        clockedIn: !!event,
        clockInAt: event?.clockInAt ?? null,
        onTime: event?.onTime ?? null,
        clockedOut: !!event?.clockOutAt,
        clockOutAt: event?.clockOutAt ?? null,
      };
    });

    // Clocked-in staff first (earliest arrival first, so late arrivals
    // still sort above no-shows), then everyone who hasn't clocked in yet,
    // alphabetically.
    roster.sort((a, b) => {
      if (a.clockedIn !== b.clockedIn) return a.clockedIn ? -1 : 1;
      if (a.clockedIn && b.clockedIn) return a.clockInAt!.getTime() - b.clockInAt!.getTime();
      return a.name.localeCompare(b.name);
    });

    return roster;
  } catch (error) {
    console.error("getStaffClockRoster failed:", error);
    return [];
  }
}

// --- Owner: attendance summary across a range of days ---------------------
//
// Same staff list as getStaffClockRoster() above, but rolled up over N
// days instead of a live snapshot of today. Takes a plain day count
// rather than named presets ("week" / "month") so this never needs to
// change shape again — a future 1-month or 1-quarter view is just another
// caller passing 30 or 90, no new query to write.

export type StaffClockRangeSummary = {
  userId: number;
  name: string;
  daysWorked: number;
  daysOnTime: number;
  daysLate: number;
  totalHours: number;
  lastClockInAt: Date | null;
};

export async function getStaffClockRosterRange(days: number): Promise<StaffClockRangeSummary[]> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "owner") return [];

    const storeId = await getActiveStoreId();
    if (!storeId) return [];

    const rangeStart = startOfToday();
    rangeStart.setDate(rangeStart.getDate() - (Math.max(1, days) - 1));

    const [staff, events] = await Promise.all([
      getActiveStoreStaff(storeId),
      prisma.clockEvent.findMany({
        where: { storeId, clockDate: { gte: rangeStart } },
      }),
    ]);
    if (staff.length === 0) return [];

    const eventsByUserId = new Map<number, typeof events>();
    for (const event of events) {
      const existing = eventsByUserId.get(event.userId);
      if (existing) existing.push(event);
      else eventsByUserId.set(event.userId, [event]);
    }

    const summary: StaffClockRangeSummary[] = staff.map((s) => {
      const userEvents = eventsByUserId.get(s.id) ?? [];
      const daysOnTime = userEvents.filter((e) => e.onTime).length;
      const totalHours = userEvents.reduce((sum, e) => {
        if (!e.clockOutAt) return sum;
        return sum + (e.clockOutAt.getTime() - e.clockInAt.getTime()) / 3_600_000;
      }, 0);
      const lastClockInAt = userEvents.reduce<Date | null>(
        (latest, e) => (!latest || e.clockInAt > latest ? e.clockInAt : latest),
        null
      );

      return {
        userId: s.id,
        name: s.fullName || "Team member",
        daysWorked: userEvents.length,
        daysOnTime,
        daysLate: userEvents.length - daysOnTime,
        totalHours: Math.round(totalHours * 10) / 10,
        lastClockInAt,
      };
    });

    // Most days worked first (so no-shows sink to the bottom), then
    // alphabetical among ties — mirrors the "active first" ordering in
    // getStaffClockRoster() above.
    summary.sort((a, b) => {
      if (a.daysWorked !== b.daysWorked) return b.daysWorked - a.daysWorked;
      return a.name.localeCompare(b.name);
    });

    return summary;
  } catch (error) {
    console.error("getStaffClockRosterRange failed:", error);
    return [];
  }
}