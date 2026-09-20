import { NextResponse } from "next/server";
import { createResendBroadcast, getMarketingSegmentId, isResendMarketingConfigured, sendResendBroadcastNow } from "@/lib/resend-marketing";
import { isValidCronAuthHeader } from "@/lib/cron-auth";
import { syncPendingMarketingConsents } from "@/lib/marketing-consent";
import { generateMarketingContent } from "@/lib/marketing-ai";
import {
  claimDueMarketingAutomations,
  createMarketingDraft,
  markMarketingDraftFailed,
  markMarketingDraftResendCreated,
  markMarketingDraftSent,
  recordAutomationResult,
} from "@/lib/marketing-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isValidCronAuthHeader(request.headers.get("authorization"))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contactSync = await syncPendingMarketingConsents(100);
    const automations = await claimDueMarketingAutomations(10);
    const results: Array<Record<string, unknown>> = [];

    for (const automation of automations) {
      let draftId: number | null = null;
      try {
        const generated = await generateMarketingContent(automation.prompt);
        const segmentId = automation.resendSegmentId || getMarketingSegmentId();

        const draft = await createMarketingDraft({
          campaignName: generated.campaignName,
          subject: generated.subject,
          previewText: generated.previewText,
          body: generated.body,
          ctaLabel: generated.ctaLabel || undefined,
          resendSegmentId: segmentId,
          prompt: automation.prompt,
          source: "automation",
          approvalRequired: automation.approvalRequired,
          automationId: automation.id,
        });

        draftId = draft.id;
        await recordAutomationResult(automation.id, draft.id);

        if (automation.approvalRequired) {
          results.push({ id: automation.id, draftId: draft.id, mode: "approval", status: "drafted" });
          continue;
        }

        if (!isResendMarketingConfigured() || !segmentId) {
          const message = "Resend marketing is not configured; automated campaign was drafted but not sent.";
          await markMarketingDraftFailed(draft.id, message);
          await recordAutomationResult(automation.id, draft.id, message);
          results.push({ id: automation.id, draftId: draft.id, mode: "automatic", status: "failed", error: message });
          continue;
        }

        const broadcast = await createResendBroadcast({
          campaignName: draft.campaignName,
          subject: draft.subject,
          body: draft.body,
          previewText: draft.previewText || undefined,
          segmentId,
          ctaLabel: draft.ctaLabel || undefined,
          ctaUrl: draft.ctaUrl || undefined,
        });

        await markMarketingDraftResendCreated(draft.id, broadcast.id);
        await sendResendBroadcastNow(broadcast.id);
        await markMarketingDraftSent(draft.id);

        results.push({
          id: automation.id,
          draftId: draft.id,
          broadcastId: broadcast.id,
          mode: "automatic",
          status: "sent",
        });
      } catch (error: any) {
        const message = error?.message || "Automated marketing run failed.";
        if (draftId) {
          await markMarketingDraftFailed(draftId, message);
          await recordAutomationResult(automation.id, draftId, message);
        } else {
          await recordAutomationResult(automation.id, 0, message);
        }
        results.push({ id: automation.id, draftId, status: "failed", error: message });
      }
    }

    return NextResponse.json({
      success: true,
      contacts: contactSync,
      processed: automations.length,
      results,
    });
  } catch (error: any) {
    console.error("[marketing-cron] failed:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Marketing automation runner failed." },
      { status: 500 },
    );
  }
}
