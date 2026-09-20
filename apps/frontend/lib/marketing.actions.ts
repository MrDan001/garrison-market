"use server";

import { getSessionUser } from "@/lib/auth";
import {
  addResendMarketingContact,
  createResendBroadcast,
  getMarketingSegmentId,
  getMarketingSegmentName,
  getResendBroadcasts,
  getResendMarketingSetupStatus,
  isResendMarketingConfigured,
  sendResendBroadcastNow,
} from "@/lib/resend-marketing";
import { generateMarketingContent, isMarketingAiConfigured } from "@/lib/marketing-ai";
import {
  approveMarketingDraft,
  createMarketingAutomation,
  createMarketingDraft,
  getMarketingDraft,
  listMarketingAutomations,
  listMarketingDrafts,
  markMarketingDraftFailed,
  markMarketingDraftResendCreated,
  markMarketingDraftSent,
  rejectMarketingDraft,
  setMarketingAutomationActive,
  type MarketingFrequency,
} from "@/lib/marketing-db";

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") throw new Error("Unauthorized");
  return session;
}

function readCampaignFields(formData: FormData) {
  return {
    campaignName: String(formData.get("campaignName") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    body: String(formData.get("body") || "").trim(),
    previewText: String(formData.get("previewText") || "").trim(),
    ctaLabel: String(formData.get("ctaLabel") || "").trim(),
    ctaUrl: String(formData.get("ctaUrl") || "").trim(),
  };
}

export async function getMarketingDashboardData() {
  await requireAdmin();
  const setup = getResendMarketingSetupStatus();
  const [drafts, automations, campaigns] = await Promise.all([
    listMarketingDrafts(),
    listMarketingAutomations(),
    isResendMarketingConfigured() ? getResendBroadcasts() : Promise.resolve([]),
  ]);

  return {
    setup,
    aiReady: isMarketingAiConfigured(),
    segment: {
      id: getMarketingSegmentId(),
      name: getMarketingSegmentName(),
    },
    campaigns,
    drafts,
    automations,
  };
}

export async function addMarketingContactAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "Enter a valid email address." };
  if (!isResendMarketingConfigured()) return { success: false, error: "Resend marketing is not configured yet." };

  try {
    await addResendMarketingContact(email, fullName || undefined);
    return { success: true };
  } catch (error: any) {
    console.error("[resend-marketing] add contact failed:", error);
    return { success: false, error: error?.message || "Could not add the contact." };
  }
}

export async function createMarketingDraftAction(formData: FormData) {
  await requireAdmin();
  const fields = readCampaignFields(formData);
  if (!fields.campaignName || !fields.subject || !fields.body) {
    return { success: false, error: "Campaign name, subject, and message are required." };
  }
  if ((fields.ctaLabel && !fields.ctaUrl) || (!fields.ctaLabel && fields.ctaUrl)) {
    return { success: false, error: "Provide both a CTA label and a CTA URL, or leave both blank." };
  }

  try {
    const draft = await createMarketingDraft({
      ...fields,
      source: "manual",
      approvalRequired: true,
      resendSegmentId: getMarketingSegmentId(),
    });
    return { success: true, draftId: draft.id };
  } catch (error: any) {
    console.error("[marketing] draft creation failed:", error);
    return { success: false, error: error?.message || "Could not create the draft." };
  }
}

export async function generateMarketingDraftAction(formData: FormData) {
  await requireAdmin();
  const prompt = String(formData.get("prompt") || "").trim();
  const ctaUrl = String(formData.get("ctaUrl") || "").trim();

  if (!prompt) return { success: false, error: "Tell the AI what campaign you want it to create." };
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return { success: false, error: "CTA URL must start with http:// or https://." };

  try {
    const generated = await generateMarketingContent(prompt);
    const draft = await createMarketingDraft({
      campaignName: generated.campaignName,
      subject: generated.subject,
      previewText: generated.previewText,
      body: generated.body,
      ctaLabel: generated.ctaLabel || undefined,
      ctaUrl: ctaUrl || undefined,
      resendSegmentId: getMarketingSegmentId(),
      prompt,
      source: "ai",
      approvalRequired: true,
    });
    return { success: true, draftId: draft.id };
  } catch (error: any) {
    console.error("[marketing] AI draft generation failed:", error);
    return { success: false, error: error?.message || "Could not generate the campaign." };
  }
}

export async function approveMarketingDraftAction(formData: FormData) {
  const session = await requireAdmin();
  const draftId = Number(formData.get("draftId"));
  if (!Number.isInteger(draftId) || draftId <= 0) return { success: false, error: "Invalid marketing draft." };

  try {
    const existing = await getMarketingDraft(draftId);
    if (!existing) return { success: false, error: "Marketing draft not found." };
    if (existing.status !== "DRAFT" && existing.status !== "FAILED") {
      return { success: false, error: `This draft is already ${existing.status.toLowerCase()}.` };
    }
    if (!isResendMarketingConfigured()) {
      return { success: false, error: "Resend marketing is not configured yet." };
    }

    const segmentId = existing.resendSegmentId || getMarketingSegmentId();
    if (!segmentId) return { success: false, error: "The Garrison Market Resend marketing segment is not configured." };

    const approved = existing.status === "DRAFT" ? await approveMarketingDraft(draftId, Number(session.id)) : existing;
    if (!approved) return { success: false, error: "This draft could not be approved." };

    let broadcastId = approved.resendBroadcastId;
    if (!broadcastId) {
      const broadcast = await createResendBroadcast({
        campaignName: approved.campaignName,
        subject: approved.subject,
        body: approved.body,
        previewText: approved.previewText || undefined,
        segmentId,
        ctaLabel: approved.ctaLabel || undefined,
        ctaUrl: approved.ctaUrl || undefined,
      });
      broadcastId = broadcast.id;
      await markMarketingDraftResendCreated(draftId, broadcast.id);
    }

    await sendResendBroadcastNow(broadcastId);
    await markMarketingDraftSent(draftId);
    return { success: true, broadcastId };
  } catch (error: any) {
    console.error("[marketing] draft approval/send failed:", error);
    await markMarketingDraftFailed(draftId, error?.message || "Could not send the approved campaign.");
    return { success: false, error: error?.message || "Could not send the approved campaign." };
  }
}

export async function rejectMarketingDraftAction(formData: FormData) {
  await requireAdmin();
  const draftId = Number(formData.get("draftId"));
  if (!Number.isInteger(draftId) || draftId <= 0) return { success: false, error: "Invalid marketing draft." };

  try {
    const draft = await rejectMarketingDraft(draftId);
    return draft ? { success: true } : { success: false, error: "This draft is no longer waiting for approval." };
  } catch (error: any) {
    return { success: false, error: error?.message || "Could not reject the draft." };
  }
}

export async function createMarketingAutomationAction(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const prompt = String(formData.get("prompt") || "").trim();
  const frequency = String(formData.get("frequency") || "weekly") as MarketingFrequency;
  const sendTime = String(formData.get("sendTime") || "09:00");
  const weekdayValue = Number(formData.get("weekday"));
  const dayOfMonthValue = Number(formData.get("dayOfMonth"));
  const approvalRequired = String(formData.get("approvalRequired") || "true") === "true";

  if (!name || !prompt) return { success: false, error: "Automation name and AI instructions are required." };
  if (!getMarketingSegmentId()) return { success: false, error: "The Garrison Market Resend marketing segment is not configured." };
  if (!["daily", "weekly", "monthly"].includes(frequency)) return { success: false, error: "Choose a valid automation frequency." };
  if (!/^\d{2}:\d{2}$/.test(sendTime)) return { success: false, error: "Use a valid UTC send time such as 09:00." };

  try {
    const automation = await createMarketingAutomation({
      name,
      prompt,
      resendSegmentId: getMarketingSegmentId(),
      frequency,
      sendTime,
      weekday: frequency === "weekly" && Number.isInteger(weekdayValue) ? weekdayValue : null,
      dayOfMonth: frequency === "monthly" && Number.isInteger(dayOfMonthValue) ? dayOfMonthValue : null,
      approvalRequired,
      createdBy: Number(session.id),
    });
    return { success: true, automationId: automation.id };
  } catch (error: any) {
    console.error("[marketing] automation creation failed:", error);
    return { success: false, error: error?.message || "Could not create the automation." };
  }
}

export async function toggleMarketingAutomationAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("automationId"));
  const active = String(formData.get("active") || "false") === "true";
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Invalid automation." };

  try {
    const automation = await setMarketingAutomationActive(id, active);
    return automation ? { success: true } : { success: false, error: "Automation not found." };
  } catch (error: any) {
    return { success: false, error: error?.message || "Could not update the automation." };
  }
}
