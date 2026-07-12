"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfileWithPhoto(formData: FormData) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  const fullName = formData.get("fullName") as string;
  const phoneNumber = formData.get("phone") as string;

  // The image is already uploaded client-side to Vercel Blob before this
  // action runs — we just receive the resulting URL, no file handling here.
  const imageUrl = formData.get("imageUrl") as string | null;

  try {
    await prisma.user.update({
      where: { email: session.email },
      data: {
        fullName,
        phoneNumber,
        ...(imageUrl && { image: imageUrl }),
      },
    });
  } catch (error) {
    console.error("Database Update Error:", error);
    throw new Error("Failed to update profile data.");
  }

  revalidatePath("/owner/profile");
}

export async function updateProfileAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  const fullName = formData.get("fullName") as string;
  const phoneNumber = formData.get("phone") as string;

  await prisma.user.update({
    where: { email: session.email },
    data: {
      fullName,
      phoneNumber,
    },
  });

  revalidatePath("/owner/profile/edit");
  revalidatePath("/owner/profile");
}
export async function updateNotificationPreference(enabled: boolean) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { email: session.email },
    data: { notificationsEnabled: enabled },
  });

  revalidatePath("/staff/profile");
  revalidatePath("/owner/profile");
  return { success: true };
}