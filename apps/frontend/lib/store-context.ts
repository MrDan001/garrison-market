"use server";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";

export async function getActiveStoreId(): Promise<number | null> {
  const session = await getSessionUser();
  if (!session) return null;

  if (session.role === "staff") {
    const staff = await prisma.user.findUnique({
      where: { id: session.id },
      select: { staffStoreId: true },
    });
    return staff?.staffStoreId ?? null;
  }

  // Owner — read the cookie set by switchStoreAction
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("activeStoreId")?.value;
  const cookieStoreId = cookieVal ? parseInt(cookieVal, 10) : null;

  if (cookieStoreId && !isNaN(cookieStoreId)) {
    // Defense-in-depth: re-verify the store actually belongs to this owner,
    // even though switchStoreAction already checks this at write-time.
    // Cookies can be edited directly (e.g. via browser devtools), so reads
    // must never blindly trust a storeId without re-checking ownership.
    const owned = await prisma.store.findFirst({
      where: { id: cookieStoreId, ownerId: session.id },
      select: { id: true },
    });
    if (owned) return owned.id;
  }

  // No valid cookie — fall back to their oldest store
  const firstStore = await prisma.store.findFirst({
    where: { ownerId: session.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return firstStore?.id ?? null;
}

// Returns the active store's id AND storeType together, so pages can branch
// between the standard (piece) and scale (weight/volume) UI/actions from a
// single source instead of each page re-deriving storeType on its own.
export async function getActiveStore(): Promise<{ id: number; storeType: string } | null> {
  const storeId = await getActiveStoreId();
  if (!storeId) return null;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, storeType: true },
  });
  return store ?? null;
}