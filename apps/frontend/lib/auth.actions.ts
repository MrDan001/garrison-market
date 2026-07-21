"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth";
import {
  sendPasswordResetEmail,
  sendOwnerWelcomeEmail,
  sendOwnerApprovedEmail,
  sendOwnerDeclinedEmail,
  sendOwnerSuspendedEmail,
  sendStaffInviteEmail,
} from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/plans";
import { assertSubscriptionActive, checkPlanLimit } from "@/lib/subscription-guard";
import { creditReferralReward } from "@/lib/referral.actions"; // 👇 Safely imported

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as any).digest === "string" &&
    (error as any).digest.startsWith("NEXT_REDIRECT")
  );
}

async function getBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
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
    } else if (userStatus === "APPROVED" || userStatus === "ACTIVE") { 
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

// Sanitize a shop name into a referral-code-safe token: uppercase,
// alphanumeric only. This must match the format used by the one-time
// SQL backfill that set referralCode for pre-existing owners, so old
// and new codes look and behave consistently.
function sanitizeToReferralToken(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Generates a referralCode that doesn't collide with an existing one.
// Tries the base sanitized store name first (e.g. "GARRISON MARKET" ->
// "GARRISONMARKET"), then appends 2, 3, 4... until a free one is found.
// Falls back to STORE + a random suffix if the name sanitizes to "".
async function generateUniqueReferralCode(storeName: string): Promise<string> {
  const base = sanitizeToReferralToken(storeName || "");
  const root = base !== "" ? base : `STORE${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  let candidate = root;
  let suffix = 1;

  // Bounded loop: extremely unlikely to need more than a handful of tries,
  // but capped so a pathological case can't loop forever.
  while (suffix < 1000) {
    const existing = await prisma.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${root}${suffix}`;
  }

  // Last-resort fallback if somehow 1000 collisions happened (practically
  // impossible) — guarantees uniqueness via a random suffix.
  return `${root}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function registerOwnerAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());

  try {
    const hashedPassword = await bcrypt.hash(data.password as string, 10);

    const appliedCodeInput = data.referralCode as string | null;
    let referrerId: number | null = null;

    if (appliedCodeInput && appliedCodeInput.trim() !== "") {
      const formattedToken = sanitizeToReferralToken(appliedCodeInput.trim());

      const referrer = await prisma.user.findUnique({
        where: { referralCode: formattedToken },
        select: { id: true }
      });

      if (referrer) {
        referrerId = referrer.id;
      }
    }

    const targetStoreName = (data.storeName as string) || "";
    const cleanNewCodeForUser = await generateUniqueReferralCode(targetStoreName);

    const newUser = await prisma.user.create({
      data: {
        email: data.email as string,
        password: hashedPassword,
        fullName: data.fullName as string,
        storeName: targetStoreName || "N/A",
        phoneNumber: data.phoneNumber as string,
        shopAddress: (data.shopAddress as string) || null,
        shopCity: (data.shopCity as string) || null,
        shopState: (data.shopState as string) || null,
        productsSold: (data.productsSold as string) || null,
        image: (data.imageUrl as string) || null,
        role: 'owner',
        status: 'pending',
        referralCode: cleanNewCodeForUser,
        referredById: referrerId,
        hasTriggeredReferralReward: false, 

        stores: {
          create: {
            name: targetStoreName || `${data.fullName}'s Store`
          }
        }
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

    // sendOwnerWelcomeEmail never throws (it returns { success, error }
    // internally), so it can't block or fail registration — but we still
    // await it, since on serverless hosts (Vercel) an un-awaited promise
    // can get frozen/killed right after the response is sent, before the
    // Resend call actually completes.
    await sendOwnerWelcomeEmail(newUser.email, newUser.fullName || "there");

    return { redirectUrl: '/pending' };

  } catch (error: any) {
    if (error.code === 'P2002') {
      // Distinguish which unique field collided so we don't wrongly tell
      // a brand-new owner their email is taken when it's actually a rare
      // race-condition collision on referralCode (generateUniqueReferralCode
      // checks first, but two requests could theoretically race).
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target || "");
      if (target.includes("email")) {
        return { error: "An account with this email already exists." };
      }
      if (target.includes("referralCode")) {
        return { error: "Please try registering again — a temporary conflict occurred generating your store token." };
      }
      return { error: "An account with these details already exists." };
    }
    console.error("Registration error:", error);
    return { error: "An unexpected error occurred." };
  }
}

// --- PASSWORD RESET ---

export async function requestPasswordResetAction(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  if (!email) return { error: "Email is required." };

  const genericSuccess = {
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return genericSuccess;

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 30 * 60 * 1000); 

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
    const cleanEmail = email.toLowerCase().trim();

    await prisma.user.create({
      data: {
        fullName,
        email: cleanEmail,
        phoneNumber,
        password: hashedPassword,
        role: "staff",
        status: "active",
        ownerId: session.id,
        staffStoreId: storeId && !isNaN(storeId) ? storeId : null,
      },
    });

    const owner = await prisma.user.findUnique({
      where: { id: session.id },
      select: { storeName: true },
    });
    const baseUrl = await getBaseUrl();
    await sendStaffInviteEmail(cleanEmail, fullName, {
      tempPassword,
      loginUrl: `${baseUrl}/login`,
      storeName: owner?.storeName || undefined,
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
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const normalizedStatus = status.toLowerCase().trim();
    const updateData: any = { status: normalizedStatus };

    if (normalizedStatus === 'approved') {
      const existing = await prisma.user.findUnique({ where: { email }, select: { trialEndsAt: true } });
      if (!existing?.trialEndsAt) {
        updateData.trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        updateData.subscriptionStatus = 'trialing';
      }
    }

    const updated = await prisma.user.update({ 
      where: { email }, 
      data: updateData
    });

    const fullName = updated.fullName || "there";
    if (normalizedStatus === "approved") {
      const baseUrl = await getBaseUrl();
      await sendOwnerApprovedEmail(email, fullName, `${baseUrl}/login`);
    } else if (normalizedStatus === "declined") {
      await sendOwnerDeclinedEmail(email, fullName);
    } else if (normalizedStatus === "suspended") {
      await sendOwnerSuspendedEmail(email, fullName);
    }

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

    // 👇 Run the reward logic if the admin sets their subscription status to active manually
    try {
      await creditReferralReward(ownerId);
    } catch (refError) {
      console.error("Referral process error during manual admin modification:", refError);
    }

    revalidatePath(`/admin/users/${ownerId}`);
    return { success: true };
  } catch (error) {
    console.error("Extend subscription error:", error);
    return { success: false, error: "Failed to extend subscription." };
  }
}

export async function setCustomPriceAction(ownerId: number, plan: "basic" | "premium", priceNaira: number | null, note?: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") return { success: false, error: "Unauthorized" };

  if (priceNaira !== null && (!priceNaira || priceNaira <= 0)) {
    return { success: false, error: "Enter a valid price, or clear it to remove the negotiated rate." };
  }

  try {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) return { success: false, error: "Owner not found." };

    const data =
      plan === "premium"
        ? {
            customPricePremiumNaira: priceNaira,
            customPricePremiumNote: priceNaira === null ? null : note || null,
          }
        : {
            customPriceBasicNaira: priceNaira,
            customPriceBasicNote: priceNaira === null ? null : note || null,
          };

    await prisma.user.update({
      where: { id: ownerId },
      data: {
        ...data,
        customPriceSetBy: priceNaira === null ? undefined : session.email,
        customPriceUpdatedAt: new Date(),
      },
    });

    revalidatePath(`/admin/users/${ownerId}`);
    revalidatePath("/owner/billing");
    return { success: true };
  } catch (error) {
    console.error("Set custom price error:", error);
    return { success: false, error: "Failed to update negotiated price." };
  }
}

export async function deleteUser(email: string) {
  const session = await getSessionUser();
  if (!session || session.role.toLowerCase() !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, error: "User not found" };

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
    return await prisma.user.findMany({
      where: { role: 'owner' },
      select: { id: true, email: true, role: true, status: true, fullName: true, storeName: true }
    });
  } catch (error) {
    console.error("Database fetch error:", error);
    return [];
  }
}