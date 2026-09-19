// FILE: apps/frontend/lib/marketing.actions.ts

"use server";

import { getSessionUser } from "@/lib/auth";
import {
  addBrevoContact,
  createBrevoCampaign,
  getBrevoCampaigns,
  getBrevoLists,
  getBrevoSetupStatus,
  isBrevoConfigured,
  sendBrevoCampaignNow,
} from "@/lib/brevo";
import { generateMarketingContent, isMarketingAiConfigured } from "@/lib/marketing-ai";
import {
  approveMarketingDraft,
  createMarketingAutomation,
  createMarketingDraft,
  getMarketingDraft,
  listMarketingAutomations,
  listMarketingDrafts,
  markMarketingDraftBrevoCreated,
  markMarketingDraftFailed,
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
    listId: (() => { const value = String(formData.get("listId") || "").trim(); return value ? Number(value) : null; })(),
  };
}

export async function getMarketingDashboardData() {
  await requireAdmin();
  const setup = getBrevoSetupStatus();
  const [drafts, automations] = await Promise.all([listMarketingDrafts(), listMarketingAutomations()]);
  if (!isBrevoConfigured()) return { setup, aiReady: isMarketingAiConfigured(), lists: [], campaigns: [], drafts, automations };
  const [lists, campaigns] = await Promise.all([getBrevoLists(), getBrevoCampaigns()]);
  return { setup, aiReady: isMarketingAiConfigured(), lists, campaigns, drafts, automations };
}

export async function addMarketingContactAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const listIdRaw = String(formData.get("listId") || "").trim();
  const listId = listIdRaw ? Number(listIdRaw) : null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "Enter a valid email address." };
  if (listId !== null && (!Number.isInteger(listId) || listId <= 0)) return { success: false, error: "Choose a valid Brevo audience list, or leave it blank for now." };
  // Admins should only add contacts who have consented to marketing email. Brevo preserves existing unsubscribe state.
  try {
    await addBrevoContact(email, fullName, listId);
    return { success: true };
  } catch (error: any) {
    console.error("[brevo] add contact failed:", error);
    return { success: false, error: error?.message || "Could not add the contact." };
  }
}

export async function createMarketingDraftAction(formData: FormData) {
  await requireAdmin();
  const fields = readCampaignFields(formData);
  if (!fields.campaignName || !fields.subject || !fields.body) return { success: false, error: "Campaign name, subject, and message are required." };
  if (fields.listId !== null && (!Number.isInteger(fields.listId) || fields.listId <= 0)) return { success: false, error: "Choose a valid Brevo audience list, or leave it blank for now." };
  if ((fields.ctaLabel && !fields.ctaUrl) || (!fields.ctaLabel && fields.ctaUrl)) return { success: false, error: "Provide both a CTA label and a CTA URL, or leave both blank." };
  try {
    const draft = await createMarketingDraft({ ...fields, source: "manual", approvalRequired: true });
    return { success: true, draftId: draft.id };
  } catch (error: any) {
    console.error("[marketing] draft creation failed:", error);
    return { success: false, error: error?.message || "Could not create the draft." };
  }
}

export async function generateMarketingDraftAction(formData: FormData) {
  await requireAdmin();
  const prompt = String(formData.get("prompt") || "").trim();
  const listId = Number(formData.get("listId"));
  const ctaUrl = String(formData.get("ctaUrl") || "").trim();
  if (!prompt) return { success: false, error: "Tell the AI what campaign you want it to create." };
  if (!Number.isInteger(listId) || listId <= 0) return { success: false, error: "Choose a valid Brevo audience list." };
  try {
    const generated = await generateMarketingContent(prompt);
    const draft = await createMarketingDraft({ campaignName: generated.campaignName, subject: generated.subject, previewText: generated.previewText, body: generated.body, ctaLabel: generated.ctaLabel || undefined, ctaUrl: ctaUrl || undefined, listId, prompt, source: "ai", approvalRequired: true });
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
    if (existing.status !== "DRAFT" && existing.status !== "FAILED") return { success: false, error: `This draft is already ${existing.status.toLowerCase()}.` };
    if (!isBrevoConfigured()) return { success: false, error: "Brevo is not configured yet. Add the Brevo API key and verified sender email first." };
    const selectedListIdRaw = String(formData.get("listId") || "").trim();
    const selectedListId = selectedListIdRaw ? Number(selectedListIdRaw) : null;
    if (selectedListId !== null && (!Number.isInteger(selectedListId) || selectedListId <= 0)) return { success: false, error: "Choose a valid Brevo audience list." };
    const targetListId = existing.listId ?? selectedListId;
    if (!targetListId) return { success: false, error: "Choose an audience list before sending this draft." };
    const approved = existing.status === "DRAFT" ? await approveMarketingDraft(draftId, Number(session.id)) : existing;
    if (!approved) return { success: false, error: "This draft could not be approved." };
    let brevoCampaignId = approved.brevoCampaignId;
    if (!brevoCampaignId) {
      const campaign = await createBrevoCampaign({ campaignName: approved.campaignName, subject: approved.subject, body: approved.body, previewText: approved.previewText || undefined, listId: targetListId, ctaLabel: approved.ctaLabel || undefined, ctaUrl: approved.ctaUrl || undefined });
      brevoCampaignId = campaign.id;
      await markMarketingDraftBrevoCreated(draftId, campaign.id);
    }
    await sendBrevoCampaignNow(brevoCampaignId);
    await markMarketingDraftSent(draftId);
    return { success: true, campaignId: brevoCampaignId };
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
  const listId = Number(formData.get("listId"));
  const frequency = String(formData.get("frequency") || "weekly") as MarketingFrequency;
  const sendTime = String(formData.get("sendTime") || "09:00");
  const weekdayValue = Number(formData.get("weekday"));
  const dayOfMonthValue = Number(formData.get("dayOfMonth"));
  const approvalRequired = String(formData.get("approvalRequired") || "true") === "true";
  if (!name || !prompt) return { success: false, error: "Automation name and AI instructions are required." };
  if (!Number.isInteger(listId) || listId <= 0) return { success: false, error: "Choose a valid Brevo audience list." };
  if (!["daily", "weekly", "monthly"].includes(frequency)) return { success: false, error: "Choose a valid automation frequency." };
  if (!/^\d{2}:\d{2}$/.test(sendTime)) return { success: false, error: "Use a valid UTC send time such as 09:00." };
  try {
    const automation = await createMarketingAutomation({ name, prompt, listId, frequency, sendTime, weekday: frequency === "weekly" && Number.isInteger(weekdayValue) ? weekdayValue : null, dayOfMonth: frequency === "monthly" && Number.isInteger(dayOfMonthValue) ? dayOfMonthValue : null, approvalRequired, createdBy: Number(session.id) });
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
