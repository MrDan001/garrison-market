"use server";

import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfileWithPhoto(formData: FormData) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  const fullName = formData.get("fullName") as string;
  const phoneNumber = formData.get("phone") as string;
  const imageFile = formData.get("image") as File;

  let imageUrl: string | undefined;

  if (imageFile && imageFile.size > 0) {
    const blob = await put(imageFile.name, imageFile, {
      access: 'public',
      addRandomSuffix: true, 
    });
    imageUrl = blob.url;
  }

  await prisma.user.update({
    where: { email: session.email },
    data: { 
      fullName, 
      phoneNumber,
      ...(imageUrl && { image: imageUrl })
    },
  });

  // Revalidate both paths to ensure the UI updates everywhere
  revalidatePath("/owner/profile/edit");
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
      phoneNumber 
    },
  });

  // Revalidate both paths
  revalidatePath("/owner/profile/edit");
  revalidatePath("/owner/profile");
}