"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { getBillingStatus } from "./subscription-guard";
import { revalidatePath } from "next/cache";
import { labelForCategory, labelForUrgency, labelForDetail } from "./support-intake-config";

export type IntakeThreadType = "owner_admin" | "staff_admin";

export interface IntakeContext {
  role: "owner" | "staff";
  needsIntake: boolean;
  prefill: { name: string; email: string; storeName: string };
  trialDaysLeft: number | null;
  subscriptionStatus: string;
}

/**
 * Decides whether the owner/staff needs to go through the intake wizard
 * before they can see the admin chat. They skip it if they already have an
 * open (unresolved) intake, or an existing message history predating this
 * feature — so nobody's past conversation gets hidden behind a form.
 */
export async function getIntakeContext(threadType: IntakeThreadType): Promise<IntakeContext | null> {
  const session = await getSessionUser();
  if (!session) return null;
  if (threadType === "owner_admin" && session.role !== "owner") return null;
  if (threadType === "staff_admin" && session.role !== "staff") return null;

  const ownerId = threadType === "owner_admin" ? session.id : session.ownerId;
  if (!ownerId) return null;

  const intakeWhereOpen =
    threadType === "owner_admin"
      ? { threadType, ownerId, status: "open" }
      : { threadType, staffId: session.id, status: "open" };

  const intakeWhereAny =
    threadType === "owner_admin" ? { threadType, ownerId } : { threadType, staffId: session.id };

  const messageWhere =
    threadType === "owner_admin"
      ? { threadType, ownerId }
      : { threadType, staffId: session.id };

  const [user, openIntake, anyIntakeCount, messageCount, billing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { fullName: true, email: true, storeName: true },
    }),
    prisma.supportIntake.findFirst({ where: intakeWhereOpen }),
    prisma.supportIntake.count({ where: intakeWhereAny }),
    prisma.supportMessage.count({ where: messageWhere }),
    getBillingStatus(ownerId),
  ]);

  // Grandfather conversations that started before this feature existed: if
  // there's message history but no intake record was ever created for it,
  // don't hide that history behind a form.
  const isLegacyThread = anyIntakeCount === 0 && messageCount > 0;

  let storeName = user?.storeName ?? "";
  if (threadType === "staff_admin" && !storeName) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { storeName: true } });
    storeName = owner?.storeName ?? "";
  }

  return {
    role: session.role as "owner" | "staff",
    needsIntake: !openIntake && !isLegacyThread,
    prefill: { name: user?.fullName ?? "", email: user?.email ?? "", storeName },
    trialDaysLeft: billing.trialDaysLeft,
    subscriptionStatus: billing.subscriptionStatus,
  };
}

export interface IntakeAnswers {
  name: string;
  storeName: string;
  email: string;
  category: string;
  urgency: string;
  blockingSales: string;
  detailAnswer: string;
  triedSelfHelp: string;
  extraNotes: string;
}

function buildIntakeSummary(a: IntakeAnswers) {
  const lines = [
    `📋 Support intake from ${a.name}${a.storeName ? ` (${a.storeName})` : ""} · ${a.email}`,
    `Category: ${labelForCategory(a.category)}`,
    `Urgency: ${labelForUrgency(a.urgency)}`,
    a.blockingSales ? `Blocking sales/POS: ${a.blockingSales === "yes" ? "Yes" : "No"}` : null,
    a.detailAnswer ? `Details: ${labelForDetail(a.category, a.detailAnswer)}` : null,
    a.triedSelfHelp ? `Already tried self-help: ${a.triedSelfHelp}` : null,
    a.extraNotes ? `Notes: ${a.extraNotes}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Called when the owner/staff hits a self-serve deflection and confirms it
 * solved their problem. Logs the intake as closed/resolved but does NOT
 * open a chat thread or notify admin — keeps the inbox to real issues only.
 */
export async function resolveIntakeSelfServed(threadType: IntakeThreadType, answers: IntakeAnswers) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerId = threadType === "owner_admin" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("Unauthorized");

  await prisma.supportIntake.create({
    data: {
      threadType,
      ownerId,
      staffId: threadType === "staff_admin" ? session.id : null,
      name: answers.name.trim(),
      storeName: answers.storeName.trim() || null,
      email: answers.email.trim(),
      category: answers.category,
      urgency: answers.urgency,
      blockingSales: answers.blockingSales || null,
      detailAnswer: answers.detailAnswer || null,
      triedSelfHelp: answers.triedSelfHelp || null,
      extraNotes: answers.extraNotes.trim() || null,
      status: "closed",
      resolvedBySelf: true,
      closedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Called when the owner/staff has no self-serve deflection or still needs
 * help after seeing one. Logs the intake as open and posts a formatted
 * summary as the first message so admin has full context immediately.
 */
export async function submitIntakeAndEscalate(threadType: IntakeThreadType, answers: IntakeAnswers) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerId = threadType === "owner_admin" ? session.id : session.ownerId;
  if (!ownerId) throw new Error("Unauthorized");

  await prisma.supportIntake.create({
    data: {
      threadType,
      ownerId,
      staffId: threadType === "staff_admin" ? session.id : null,
      name: answers.name.trim(),
      storeName: answers.storeName.trim() || null,
      email: answers.email.trim(),
      category: answers.category,
      urgency: answers.urgency,
      blockingSales: answers.blockingSales || null,
      detailAnswer: answers.detailAnswer || null,
      triedSelfHelp: answers.triedSelfHelp || null,
      extraNotes: answers.extraNotes.trim() || null,
      status: "open",
    },
  });

  await prisma.supportMessage.create({
    data: {
      threadType,
      ownerId,
      staffId: threadType === "staff_admin" ? session.id : null,
      senderId: session.id,
      senderRole: session.role,
      content: buildIntakeSummary(answers),
    },
  });

  revalidatePath("/admin/support");
  revalidatePath(threadType === "owner_admin" ? "/owner/support" : "/staff/dashboard");

  return { success: true };
}

/**
 * Admin action: marks the conversation resolved so the owner/staff goes
 * through a fresh intake next time they reach out about a new issue.
 */
export async function adminCloseIntake(threadType: IntakeThreadType, ownerId: number, staffId?: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") throw new Error("Unauthorized");

  await prisma.supportIntake.updateMany({
    where:
      threadType === "owner_admin"
        ? { threadType, ownerId, status: "open" }
        : { threadType, staffId, status: "open" },
    data: { status: "closed", closedAt: new Date() },
  });

  revalidatePath("/admin/support");
  return { success: true };
}
