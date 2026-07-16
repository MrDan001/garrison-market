//lib/store.actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function switchStoreAction(storeId: number) {
  const cookieStore = await cookies();
  // Store the active store ID in a secure cookie
  cookieStore.set("activeStoreId", storeId.toString(), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Redirect to the dashboard which will read this cookie
  redirect("/owner/dashboard");
}