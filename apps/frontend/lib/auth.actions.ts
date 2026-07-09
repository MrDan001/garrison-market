"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth";

// Detects a Next.js redirect "error" by its digest, since isRedirectError
// is no longer publicly exported in Next 16.
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as any).digest === "string" &&
    (error as any).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function safeRedirect(url: string): Promise<never> {
  try {
    redirect(url);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    throw error;
  }
}

// --- AUTH ACTIONS ---

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) return null;

  try {
    const numericUserId = Number(payload.userId);
    if (isNaN(numericUserId)) return null;

    return await prisma.user.findUnique({
      where: { id: numericUserId },
      select: { 
        id: true, 
        email: true, 
        role: true, 
        status: true, 
        ownerId: true,
        fullName: true // 🌟 FIX: Added this line to resolve the Invoice page crash!
      }
    });
  } catch (error) {
    console.error("Error retrieving session user:", error);
    return null;
  }
}



export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required." };

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return { error: "Invalid email or password." };
    }

    // SAFE CONVERSION: Prevents crashing if a status is unusual or missing
    const userRole = (user.role || "").toLowerCase().trim();
    const userStatus = (user.status || "").toUpperCase().trim();

    // Set signed cookie helper
    const setSessionCookie = async () => {
      const token = await signToken(user.id, user.role);
      const cookieStore = await cookies();
      cookieStore.set("session-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    };

    // Handle suspended or pending users
    if (userStatus === "SUSPENDED" || userStatus === "PENDING") {
      await setSessionCookie();
      if (userRole === "staff") {
        await safeRedirect("/pending/staff");
      } else {
        await safeRedirect("/pending");
      }
    }

    await setSessionCookie();

    // Bypasses the "APPROVED" check specifically for Admins so they can log in instantly
    if (userRole === "owner" && userStatus !== "APPROVED") await safeRedirect("/pending");
    
    // Distinct routing paths for each role
    if (userRole === "admin") await safeRedirect("/admin/dashboard");
    if (userRole === "owner") await safeRedirect("/owner/dashboard");
    if (userRole === "staff") await safeRedirect("/staff/dashboard");

    return { error: "Account configuration error. Your user role is unrecognized." };

  } catch (error) {
    if (
      isNextRedirectError(error) || 
      (error instanceof Error && error.message === "NEXT_REDIRECT") ||
      (typeof error === "object" && error !== null && "digest" in error && String((error as any).digest).startsWith("NEXT_REDIRECT"))
    ) {
      throw error; 
    }

    console.error("Login execution error:", error);
    return { error: "An unexpected system error occurred." };
  }
}


export async function registerOwnerAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());

  try {
    const hashedPassword = await bcrypt.hash(data.password as string, 10);

    const newUser = await prisma.user.create({
      data: {
        email: data.email as string,
        password: hashedPassword,
        fullName: data.fullName as string,
        storeName: (data.storeName as string) || "N/A",
        phoneNumber: data.phoneNumber as string,
        role: 'owner',
        status: 'pending'
      }
    });

    const token = await signToken(newUser.id, newUser.role);
    const cookieStore = await cookies();
    cookieStore.set("session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    revalidatePath('/admin/users');
    await safeRedirect('/pending');

  } catch (error: any) {
    if (isNextRedirectError(error)) throw error;
    if (error.code === 'P2002') {
      return { error: "An account with this email already exists." };
    }
    console.error("Registration error:", error);
    return { error: "An unexpected error occurred." };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session-token");
  await safeRedirect("/login");
}

// --- STAFF & OWNER ACTIONS ---

export async function registerStaffAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== 'owner') {
    return { success: false, error: "Unauthorized" };
  }

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const tempPassword = formData.get("tempPassword") as string;
  const phoneNumber = formData.get("phoneNumber") as string;

  if (!email || !tempPassword) {
    return { success: false, error: "Email and password are required." };
  }

  try {
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.create({
      data: {
        fullName,
        email: email.toLowerCase().trim(),
        phoneNumber,
        password: hashedPassword,
        role: "staff",
        status: "active",
        ownerId: session.id,
      },
    });

    revalidatePath("/owner/staff");
    return { success: true };

  } catch (error: any) {
    console.error("Staff Creation Error:", error);
    if (error.code === 'P2002') {
      return {
        success: false,
        error: "An account with this email already exists. Please use a different email address."
      };
    }
    return {
      success: false,
      error: "Failed to create staff account. Please try again later."
    };
  }
}

export async function getStaffData() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role.toLowerCase() !== 'owner') throw new Error("Unauthorized");
  return await prisma.user.findMany({
    where: { ownerId: sessionUser.id, role: 'staff' }
  });
}

export async function deleteStaff(id: number) {
  await prisma.user.delete({ where: { id } });
  revalidatePath("/owner/staff");
}

export async function toggleStaffStatus(id: number, currentStatus: string) {
  const newStatus = currentStatus.toLowerCase() === 'active' ? 'suspended' : 'active';
  await prisma.user.update({
    where: { id },
    data: { status: newStatus },
  });
  revalidatePath("/owner/staff");
}

// --- ADMIN ACTIONS ---

export async function updateOwnerStatus(email: string, status: 'approved' | 'declined' | 'suspended') {
  try {
    await prisma.user.update({ where: { email }, data: { status } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update status" };
  }
}

export async function deleteUser(email: string) {
  try {
    await prisma.user.delete({ where: { email } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete user" };
  }
}

export async function getOwnersForAdmin() {
  try {
    const owners = await prisma.user.findMany({
      where: { role: 'owner' },
      select: { id: true, email: true, role: true, status: true, fullName: true, storeName: true }
    });
    return owners;
  } catch (error) {
    console.error("Database fetch error:", error);
    return [];
  }
}