// FILE: apps/frontend/app/admin/dev-assistant/page.tsx

import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrCreateDevAssistantThread } from "@/lib/dev-assistant.actions";
import { getDevAssistantProject } from "@/lib/dev-assistant-project.actions";
import DevAssistantClient from "./dev-assistant-client";

export const dynamic = "force-dynamic";

// Admin-only, same guard pattern as every other /admin page (see
// app/admin/support/page.tsx). Owners and staff never see this route, and
// the "Ask Me" assistant they use (store-assistant.actions.ts) is
// completely untouched by anything in this feature.
export default async function DevAssistantPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const [{ threadId, messages }, project] = await Promise.all([
    getOrCreateDevAssistantThread(),
    getDevAssistantProject(),
  ]);

  return <DevAssistantClient threadId={threadId} initialMessages={messages} initialProject={project} />;
}