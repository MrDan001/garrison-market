"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth";

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
  if (!payload) return null;

  try {
    return await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true, ownerId: true }
    });
  } catch {
    return null;
  }
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required." };

  let redirectUrl: string | null = null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return { error: "Invalid email or password." };
    }

    const userRole = user.role.toLowerCase().trim();
    const userStatus = user.status.toUpperCase().trim();

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

    if (userStatus === "PENDING" || userStatus === "SUSPENDED" || userStatus === "DECLINED") {
      await setSessionCookie();
      redirectUrl = userRole === "staff" ? "/pending/staff" : "/pending/staff";
    } else if (userStatus === "APPROVED" || userStatus === "ACTIVE") { // 👈 Fixed: Now catches both uppercase "APPROVED" and "ACTIVE"
      await setSessionCookie();

      if (userRole === "admin") redirectUrl = "/admin/dashboard";
      else if (userRole === "owner") redirectUrl = "/owner/dashboard";
      else if (userRole === "staff") redirectUrl = "/staff/dashboard";
      else {
        return { error: "Account configuration error. Your user role is unrecognized." };
      }
    } else {
      return { error: "Account status configuration error. Unrecognized status state." };
    }
  } catch (error) {
    console.error("Login execution error:", error);
    return { error: "An unexpected system error occurred." };
  }

  return { redirectUrl };
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
        shopAddress: (data.shopAddress as string) || null,
        shopCity: (data.shopCity as string) || null,
        shopState: (data.shopState as string) || null,
        productsSold: (data.productsSold as string) || null,
        image: (data.imageUrl as string) || null,
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

    return { redirectUrl: '/pending' };

  } catch (error: any) {
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
  const storeIdRaw = formData.get("storeId") as string | null;
  const storeId = storeIdRaw ? parseInt(storeIdRaw, 10) : null;

  if (!email || !tempPassword) {
    return { success: false, error: "Email and password are required." };
  }

  // If a storeId was provided, confirm it actually belongs to this owner
  // before assigning staff to it — prevents cross-owner store assignment.
  if (storeId && !isNaN(storeId)) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId: session.id },
      select: { id: true },
    });
    if (!store) {
      return { success: false, error: "Invalid store selected." };
    }
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
        staffStoreId: storeId && !isNaN(storeId) ? storeId : null,
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
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "owner") throw new Error("Unauthorized");

  const staff = await prisma.user.findFirst({
    where: { id, ownerId: session.id, role: "staff" },
    select: { id: true },
  });
  if (!staff) throw new Error("Unauthorized");

  await prisma.user.delete({ where: { id } });
  revalidatePath("/owner/staff");
}

export async function toggleStaffStatus(id: number, currentStatus: string) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "owner") throw new Error("Unauthorized");

  const staff = await prisma.user.findFirst({
    where: { id, ownerId: session.id, role: "staff" },
    select: { id: true },
  });
  if (!staff) throw new Error("Unauthorized");

  const newStatus = currentStatus.toLowerCase() === 'active' ? 'suspended' : 'active';
  await prisma.user.update({
    where: { id },
    data: { status: newStatus },
  });
  revalidatePath("/owner/staff");
}

// -- ADMIN ACTIONS --

export async function updateOwnerStatus(email: string, status: 'approved' | 'declined' | 'suspended') {
  try {
    const normalizedStatus = status.toLowerCase().trim();

    await prisma.user.update({ 
      where: { email }, 
      data: { status: normalizedStatus } 
    });
    
    revalidatePath("/admin/users");
    revalidatePath("/pending");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update status" };
  }
}

export async function deleteUser(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, error: "User not found" };

    // Transaction to delete all related data in the correct order
    await prisma.$transaction([
      // 1. Delete associated inventory
      prisma.inventory.deleteMany({ where: { ownerId: user.id } }),
      // 2. Delete associated orders (This is what was blocking the delete)
      prisma.order.deleteMany({ where: { ownerId: user.id } }),
      // 3. Finally, delete the user
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Delete failed:", error);
    return { success: false, error: "Failed to delete user. Check server logs." };
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