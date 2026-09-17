// FILE: apps/frontend/lib/marketing.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import {
  addBrevoContact,
  createAndSendBrevoCampaign,
  getBrevoCampaigns,
  getBrevoLists,
  getBrevoSetupStatus,
  isBrevoConfigured,
} from "@/lib/brevo";

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    throw new Error("Unauthorized");
  }
}

export async function getMarketingDashboardData() {
  await requireAdmin();

  const setup = getBrevoSetupStatus();
  if (!isBrevoConfigured()) {
    return { setup, lists: [], campaigns: [] };
  }

  const [lists, campaigns] = await Promise.all([getBrevoLists(), getBrevoCampaigns()]);
  return { setup, lists, campaigns };
}

export async function addMarketingContactAction(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const listId = Number(formData.get("listId"));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (!Number.isInteger(listId) || listId <= 0) {
    return { success: false, error: "Choose a valid Brevo audience list." };
  }

  try {
    await addBrevoContact(email, fullName, listId);
    return { success: true };
  } catch (error: any) {
    console.error("[brevo] add contact failed:", error);
    return { success: false, error: error?.message || "Could not add the contact." };
  }
}

export async function sendMarketingCampaignAction(formData: FormData) {
  await requireAdmin();

  const campaignName = String(formData.get("campaignName") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const previewText = String(formData.get("previewText") || "").trim();
  const ctaLabel = String(formData.get("ctaLabel") || "").trim();
  const ctaUrl = String(formData.get("ctaUrl") || "").trim();
  const listId = Number(formData.get("listId"));

  if (!campaignName || !subject || !body) {
    return { success: false, error: "Campaign name, subject, and message are required." };
  }
  if (!Number.isInteger(listId) || listId <= 0) {
    return { success: false, error: "Choose a valid Brevo audience list." };
  }
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    return { success: false, error: "Provide both a CTA label and a CTA URL, or leave both blank." };
  }

  try {
    const result = await createAndSendBrevoCampaign({
      campaignName,
      subject,
      body,
      previewText: previewText || undefined,
      listId,
      ctaLabel: ctaLabel || undefined,
      ctaUrl: ctaUrl || undefined,
    });

    return { success: true, campaignId: result.campaignId };
  } catch (error: any) {
    console.error("[brevo] campaign send failed:", error);
    return { success: false, error: error?.message || "Could not send the campaign." };
  }
}
