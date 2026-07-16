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
  if (cookieVal) return parseInt(cookieVal, 10);

  // No cookie yet (e.g. right after registration) — fall back to their oldest store
  const firstStore = await prisma.store.findFirst({
    where: { ownerId: session.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return firstStore?.id ?? null;
}