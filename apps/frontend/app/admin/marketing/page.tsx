import MarketingClient from "./marketing-client";
import { getMarketingDashboardData } from "@/lib/marketing.actions";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  let data;
  let loadError: string | null = null;

  try {
    data = await getMarketingDashboardData();
  } catch (error: any) {
    loadError = error?.message || "Could not load Resend marketing data.";
    data = {
      setup: { apiKey: false, senderEmail: false, segmentId: false },
      aiReady: Boolean(process.env.OPENROUTER_API_KEY),
      lists: [],
      segment: { id: process.env.RESEND_MARKETING_SEGMENT_ID || null, name: "Garrison Market Marketing Subscribers" },
      campaigns: [],
      drafts: [],
      automations: [],
    };
  }

  return <MarketingClient {...data} loadError={loadError} />;
}
