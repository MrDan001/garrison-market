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

  // Only attempt upload if there is a file
  if (imageFile && imageFile.size > 0) {
    try {
      // 1. Sanitize the filename to prevent upload crashes
      const fileExtension = imageFile.name.split('.').pop() || 'jpg';
      const safeFileName = `profiles/${session.id}-${Date.now()}.${fileExtension}`;

      // 2. Upload to Vercel Blob
      const blob = await put(safeFileName, imageFile, {
        access: 'public',
        contentType: imageFile.type, // Required for proper image handling
        addRandomSuffix: true, 
      });
      imageUrl = blob.url;
    } catch (error) {
      console.error("Blob Upload Error:", error);
      throw new Error("Failed to upload image to storage.");
    }
  }

  // 3. Update User in DB
  try {
    await prisma.user.update({
      where: { email: session.email },
      data: { 
        fullName, 
        phoneNumber,
        ...(imageUrl && { image: imageUrl })
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
      phoneNumber 
    },
  });

  // Revalidate both paths
  revalidatePath("/owner/profile/edit");
  revalidatePath("/owner/profile");
}