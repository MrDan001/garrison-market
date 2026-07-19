"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/plans";
import { assertSubscriptionActive, checkPlanLimit } from "@/lib/subscription-guard";

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

// --- PASSWORD RESET ---

export async function requestPasswordResetAction(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  if (!email) return { error: "Email is required." };

  // Always return a generic success message, whether or not the account
  // exists — this avoids leaking which emails are registered.
  const genericSuccess = {
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return genericSuccess;

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    const result = await sendPasswordResetEmail(email, resetUrl);
    if (!result.success) {
      // Email service failed (e.g. missing API key) — don't block, but log clearly.
      console.error("Password reset email failed to send for:", email);
    }

    return genericSuccess;
  } catch (error) {
    console.error("Password reset request error:", error);
    return genericSuccess;
  }
}

export async function resetPasswordAction(token: string, formData: FormData) {
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return { error: "This reset link is invalid or has expired. Please request a new one." };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session-token");
  await safeRedirect("/login");
}

export async function sessionTimeoutLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session-token");
  await safeRedirect("/login?reason=timeout");
}

// --- STAFF & OWNER ACTIONS ---

export async function registerStaffAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== 'owner') {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await assertSubscriptionActive(session.id);
  } catch {
    return { success: false, error: "Your trial or subscription has ended. Please upgrade to add staff." };
  }
  const staffLimit = await checkPlanLimit(session.id, "staff");
  if (!staffLimit.allowed) {
    return { success: false, error: staffLimit.reason };
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
  
  const staff = await prisma.user.findMany({
    where: { ownerId: sessionUser.id, role: 'staff' }
  });

  // Deep sterilize to safely convert Decimals and Dates into safe primitives before hitting the wire
  return JSON.parse(
    JSON.stringify(staff, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") {
        return Number(value);
      }
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );
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

// --- ADMIN ACTIONS ---

export async function updateOwnerStatus(email: string, status: 'approved' | 'declined' | 'suspended') {
  try {
    const normalizedStatus = status.toLowerCase().trim();

    const updateData: any = { status: normalizedStatus };

    // Start the 14-day free trial the moment an owner is approved — not at
    // raw signup, since they can't use the app until approved anyway.
    if (normalizedStatus === 'approved') {
      const existing = await prisma.user.findUnique({ where: { email }, select: { trialEndsAt: true } });
      if (!existing?.trialEndsAt) {
        updateData.trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        updateData.subscriptionStatus = 'trialing';
      }
    }

    await prisma.user.update({ 
      where: { email }, 
      data: updateData
    });
    
    revalidatePath("/admin/users");
    revalidatePath("/pending");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update status" };
  }
}

export async function extendSubscriptionAction(ownerId: number, days: number, reason?: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false, error: "Unauthorized" };
  if (!days || days <= 0) return { success: false, error: "Days must be a positive number." };

  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
    });
    if (!owner) return { success: false, error: "Owner not found." };

    const msPerDay = 24 * 60 * 60 * 1000;
    const now = new Date();

    if (owner.subscriptionStatus === "trialing") {
      // Push the trial end date out, extending from whichever is later —
      // "now" if it already expired, or the existing date if still running.
      const base = owner.trialEndsAt && owner.trialEndsAt > now ? owner.trialEndsAt : now;
      await prisma.user.update({
        where: { id: ownerId },
        data: { trialEndsAt: new Date(base.getTime() + days * msPerDay) },
      });
    } else {
      const base = owner.currentPeriodEnd && owner.currentPeriodEnd > now ? owner.currentPeriodEnd : now;
      await prisma.user.update({
        where: { id: ownerId },
        data: { currentPeriodEnd: new Date(base.getTime() + days * msPerDay), subscriptionStatus: "active" },
      });
    }

    await prisma.planExtension.create({
      data: {
        ownerId,
        days,
        reason: reason || null,
        grantedBy: session.email,
      },
    });

    revalidatePath(`/admin/users/${ownerId}`);
    return { success: true };
  } catch (error) {
    console.error("Extend subscription error:", error);
    return { success: false, error: "Failed to extend subscription." };
  }
}

export async function deleteUser(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, error: "User not found" };

    // Full cascade: flush every record attached to this owner, including
    // their staff accounts and everything the staff created. Order matters —
    // children before parents. Runs in one transaction so it's all-or-nothing.
    const ownerId = user.id;
    const staff = await prisma.user.findMany({ where: { ownerId }, select: { id: true } });
    const staffIds = staff.map((s) => s.id);

    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { order: { ownerId } } }),
      prisma.reportItem.deleteMany({ where: { report: { ownerId } } }),
      prisma.consignmentItem.deleteMany({ where: { consignment: { ownerId } } }),
      prisma.order.deleteMany({ where: { ownerId } }),
      prisma.report.deleteMany({ where: { ownerId } }),
      prisma.consignment.deleteMany({ where: { ownerId } }),
      prisma.notification.deleteMany({ where: { ownerId } }),
      prisma.supportMessage.deleteMany({ where: { ownerId } }),
      prisma.inventory.deleteMany({ where: { ownerId } }),
      prisma.payment.deleteMany({ where: { ownerId } }),
      prisma.planExtension.deleteMany({ where: { ownerId } }),
      prisma.store.deleteMany({ where: { ownerId } }),
      // Staff accounts belonging to this owner
      ...(staffIds.length > 0 ? [prisma.user.deleteMany({ where: { id: { in: staffIds } } })] : []),
      prisma.user.delete({ where: { id: ownerId } }),
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