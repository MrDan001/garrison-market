"use client";

import React, { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, CheckCircle2, Clock3, Mail, Pause, Play, Plus, Send, Sparkles, Users, XCircle } from "lucide-react";
import {
  addMarketingContactAction,
  approveMarketingDraftAction,
  createMarketingAutomationAction,
  createMarketingDraftAction,
  generateMarketingDraftAction,
  rejectMarketingDraftAction,
  toggleMarketingAutomationAction,
} from "@/lib/marketing.actions";

const CONTROL_INPUT = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500";

type List = { id: number; name: string; totalSubscribers?: number; uniqueSubscribers?: number };
type Campaign = { id: number; name: string; status: string; subject?: string; createdAt?: string; scheduledAt?: string; sentDate?: string };
type Draft = {
  id: number; campaignName: string; subject: string; previewText: string; body: string; ctaLabel: string | null; ctaUrl: string | null; listId: number | null;
  prompt: string | null; source: "manual" | "ai" | "automation"; status: "DRAFT" | "APPROVED" | "REJECTED" | "SENT" | "FAILED";
  approvalRequired: boolean; automationId: number | null; approvedBy: number | null; approvedAt: string | null; brevoCampaignId: number | null;
  sentAt: string | null; error: string | null; createdAt: string; updatedAt: string;
};
type Automation = {
  id: number; name: string; prompt: string; listId: number; frequency: "daily" | "weekly" | "monthly"; sendTime: string;
  weekday: number | null; dayOfMonth: number | null; active: boolean; approvalRequired: boolean; lastRunAt: string | null;
  nextRunAt: string | null; lastDraftId: number | null; lastError: string | null; createdBy: number | null; createdAt: string; updatedAt: string;
};
type Props = {
  setup: { apiKey: boolean; senderEmail: boolean };
  aiReady: boolean;
  lists: List[];
  campaigns: Campaign[];
  drafts: Draft[];
  automations: Automation[];
  loadError: string | null;
};

export default function MarketingClient({ setup, aiReady, lists, campaigns, drafts, automations, loadError }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isContactBusy, startContact] = useTransition();
  const [isDraftBusy, startDraft] = useTransition();
  const [isAiBusy, startAi] = useTransition();
  const [isApprovalBusy, startApproval] = useTransition();
  const [isAutomationBusy, startAutomation] = useTransition();

  const ready = setup.apiKey && setup.senderEmail;
  const hasList = lists.length > 0;
  const pending = drafts.filter((draft) => draft.status === "DRAFT" || draft.status === "FAILED");

  function refresh(text: string) {
    setMessage(text);
    router.refresh();
  }

  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); const form = event.currentTarget;
    startContact(async () => { const result = await addMarketingContactAction(new FormData(form)); if (result.success) { form.reset(); refresh("Contact added to the selected Brevo marketing list."); } else setMessage(result.error || "Could not add contact."); });
  }

  function handleManualDraftSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); const form = event.currentTarget;
    startDraft(async () => { const result = await createMarketingDraftAction(new FormData(form)); if (result.success) { form.reset(); refresh(`Draft #${result.draftId} created. It is waiting for your approval.`); } else setMessage(result.error || "Could not create the draft."); });
  }

  function handleAiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); const form = event.currentTarget;
    startAi(async () => { const result = await generateMarketingDraftAction(new FormData(form)); if (result.success) { form.reset(); refresh(`AI draft #${result.draftId} created. Review it below, then approve it when ready.`); } else setMessage(result.error || "Could not generate the campaign."); });
  }

  function handleApprove(draftId: number, listId?: number | null) {
    if (!window.confirm("Approve this campaign and send it to the selected Brevo audience now?")) return;
    setMessage(null); const data = new FormData(); data.set("draftId", String(draftId));
    if (listId) data.set("listId", String(listId));
    startApproval(async () => { const result = await approveMarketingDraftAction(data); if (result.success) refresh(`Campaign approved and sent. Brevo campaign #${result.campaignId}.`); else setMessage(result.error || "Could not send the approved campaign."); });
  }

  function handleReject(draftId: number) {
    if (!window.confirm("Reject this marketing draft?")) return;
    setMessage(null); const data = new FormData(); data.set("draftId", String(draftId));
    startApproval(async () => { const result = await rejectMarketingDraftAction(data); if (result.success) refresh("Marketing draft rejected."); else setMessage(result.error || "Could not reject the draft."); });
  }

  function handleAutomationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); const form = event.currentTarget;
    startAutomation(async () => { const result = await createMarketingAutomationAction(new FormData(form)); if (result.success) { form.reset(); refresh(`Automation #${result.automationId} created and scheduled.`); } else setMessage(result.error || "Could not create the automation."); });
  }

  function handleToggleAutomation(automation: Automation) {
    setMessage(null); const data = new FormData(); data.set("automationId", String(automation.id)); data.set("active", String(!automation.active));
    startAutomation(async () => { const result = await toggleMarketingAutomationAction(data); if (result.success) refresh(`Automation ${automation.active ? "paused" : "activated"}.`); else setMessage(result.error || "Could not update the automation."); });
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2"><Mail size={21} /> Marketing Command Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">Brevo handles Garrison Market marketing email. Resend remains the transactional email provider. AI can create campaigns for approval, while scheduled automations can run fully automatically.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-[260px]"><StatusCard icon={<Sparkles size={15} />} label="AI generation" value={aiReady ? "Ready" : "Needs AI key"} ok={aiReady} /><StatusCard icon={<Send size={15} />} label="Brevo delivery" value={ready ? "Ready" : "Needs setup"} ok={ready} /></div>
      </header>

      {message && <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{message}</div>}
      {loadError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{loadError}</div>}

      {!ready && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><div className="flex items-start gap-3"><AlertTriangle className="text-amber-400 mt-0.5" size={18} /><div className="w-full"><h2 className="text-sm font-bold text-[var(--text-primary)]">Brevo setup is incomplete</h2><p className="text-xs text-slate-400 mt-1">AI drafts and automation configuration can be built now, but delivery requires the Brevo API key and verified sender email.</p><div className="grid sm:grid-cols-2 gap-2 mt-4"><SetupItem label="BREVO_API_KEY" ready={setup.apiKey} /><SetupItem label="BREVO_SENDER_EMAIL" ready={setup.senderEmail} /></div></div></div></section>}

      <div className="grid xl:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-violet-500/20 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><Bot size={18} className="text-violet-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">AI Campaign Studio</h2><p className="text-[11px] text-slate-400 mt-0.5">AI writes the campaign. Nothing is sent until you approve it.</p></div></div>
          <form onSubmit={handleAiSubmit} className="space-y-3">
            <select name="listId" disabled={!aiReady || isAiBusy} defaultValue={lists[0]?.id ? String(lists[0].id) : ""} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="">No audience yet — generate draft first</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} — {list.uniqueSubscribers ?? list.totalSubscribers ?? 0} contacts</option>)}</select>
            <textarea name="prompt" required rows={7} disabled={!aiReady || isAiBusy} placeholder="Example: Create a friendly weekend campaign reminding small shop owners that Garrison Market helps them track stock, sales and customers. Keep it useful and not pushy." className={`${CONTROL_INPUT} resize-y disabled:opacity-50`} />
            <input name="ctaUrl" type="url" disabled={!aiReady || isAiBusy} placeholder="CTA URL (optional — use a real Garrison Market URL)" className={`${CONTROL_INPUT} disabled:opacity-50`} />
            <button type="submit" disabled={!aiReady || isAiBusy} className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><Sparkles size={15} />{isAiBusy ? "Generating AI draft…" : "Generate AI Draft"}</span></button>
          </form>
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><Clock3 size={18} className="text-emerald-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">Fully Automated Marketing</h2><p className="text-[11px] text-slate-400 mt-0.5">AI creates a campaign on schedule. Choose whether each run needs your approval.</p></div></div>
          <form onSubmit={handleAutomationSubmit} className="space-y-3">
            <input name="name" required placeholder="Automation name — e.g. Weekly value email" disabled={isAutomationBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} />
            <select name="listId" required disabled={!hasList || isAutomationBusy} defaultValue={lists[0]?.id ? String(lists[0].id) : ""} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="">Choose audience list</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
            <textarea name="prompt" required rows={4} disabled={!hasList || isAutomationBusy} placeholder="Example: Send one practical weekly tip for small shop owners, with a soft invitation to use Garrison Market." className={`${CONTROL_INPUT} resize-y disabled:opacity-50`} />
            <div className="grid sm:grid-cols-2 gap-3"><select name="frequency" defaultValue="weekly" disabled={isAutomationBusy} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><select name="weekday" defaultValue="1" disabled={isAutomationBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} title="Used for weekly automations"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></div>
            <div className="grid sm:grid-cols-[1fr_auto] gap-3"><input name="dayOfMonth" type="number" min="1" max="28" defaultValue="1" disabled={isAutomationBusy} placeholder="Monthly day (1-28)" className={`${CONTROL_INPUT} disabled:opacity-50`} /><select name="approvalRequired" defaultValue="true" disabled={isAutomationBusy} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="true">Create draft → I approve</option><option value="false">Fully automatic → send</option></select></div>
            <p className="text-[10px] text-slate-500">On the current Vercel plan, the marketing worker runs once daily at 09:00 UTC. Daily, weekly, and monthly automations are processed automatically at that daily check; approval-mode runs create a draft for you before sending.</p>
            <button type="submit" disabled={!hasList || isAutomationBusy} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><Plus size={15} />{isAutomationBusy ? "Saving…" : "Create Automation"}</span></button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><Clock3 size={17} className="text-emerald-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">Active Automations</h2><p className="text-[11px] text-slate-400 mt-0.5">Each automation uses its saved AI instructions to create the next campaign.</p></div></div><span className="text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{automations.filter((item) => item.active).length} active</span></div>
        {automations.length === 0 ? <p className="text-xs text-slate-400">No automations created yet.</p> : <div className="space-y-3">{automations.map((automation) => { const audience = lists.find((item) => item.id === automation.listId)?.name ?? `List #${automation.listId}`; return <div key={automation.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[var(--text-primary)]">{automation.name}</p><StatusPill text={automation.active ? "active" : "paused"} tone={automation.active ? "green" : "gray"} /><StatusPill text={automation.approvalRequired ? "approval" : "auto-send"} tone="blue" /></div><p className="text-xs text-slate-400 mt-1">{automation.frequency} · {audience}</p><p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{automation.prompt}</p>{automation.nextRunAt && <p className="text-[10px] text-slate-500 mt-2">Next run: {new Date(automation.nextRunAt).toLocaleString()}</p>}{automation.lastError && <p className="text-[10px] text-rose-400 mt-2">Last error: {automation.lastError}</p>}</div><button type="button" onClick={() => handleToggleAutomation(automation)} disabled={isAutomationBusy} className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"><span className="inline-flex items-center gap-2">{automation.active ? <Pause size={14} /> : <Play size={14} />}{automation.active ? "Pause" : "Activate"}</span></button></div></div>; })}</div>}
      </section>

      <div className="grid xl:grid-cols-[0.88fr_1.12fr] gap-6">
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><Users size={17} className="text-blue-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">Add Marketing Contact</h2><p className="text-[11px] text-slate-400 mt-0.5">Add a consenting contact to one of your Brevo audience lists.</p></div></div>
          <form onSubmit={handleContactSubmit} className="space-y-3"><input name="fullName" placeholder="Full name (optional)" disabled={!ready || isContactBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><input name="email" type="email" required placeholder="Email address" disabled={!ready || isContactBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><select name="listId" defaultValue={lists[0]?.id ? String(lists[0].id) : ""} required disabled={!ready || isContactBusy || !hasList} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="">Choose audience list</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} — {list.uniqueSubscribers ?? list.totalSubscribers ?? 0} contacts</option>)}</select><button type="submit" disabled={!ready || isContactBusy || !hasList} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><Plus size={15} />{isContactBusy ? "Adding…" : "Add Contact"}</span></button></form>
        </section>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><Send size={17} className="text-emerald-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">Manual Campaign Draft</h2><p className="text-[11px] text-slate-400 mt-0.5">Write it yourself, create a draft, then approve it before sending.</p></div></div>
          <form onSubmit={handleManualDraftSubmit} className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><input name="campaignName" required placeholder="Campaign name" disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><select name="listId" defaultValue={lists[0]?.id ? String(lists[0].id) : ""} disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`}><option value="">No audience yet — create draft first</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></div><input name="subject" required placeholder="Email subject" disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><input name="previewText" placeholder="Preview text / preheader (optional)" disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><textarea name="body" required rows={8} placeholder="Write the marketing message here." disabled={isDraftBusy} className={`${CONTROL_INPUT} resize-y disabled:opacity-50`} /><div className="grid sm:grid-cols-2 gap-3"><input name="ctaLabel" placeholder="CTA label (optional)" disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /><input name="ctaUrl" type="url" placeholder="CTA URL (optional)" disabled={isDraftBusy} className={`${CONTROL_INPUT} disabled:opacity-50`} /></div><button type="submit" disabled={isDraftBusy} className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><Clock3 size={15} />{isDraftBusy ? "Creating draft…" : "Create Draft for Approval"}</span></button></form>
        </section>
      </div>

      <section className="rounded-2xl border border-amber-500/20 bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><CheckCircle2 size={17} className="text-amber-400" /><div><h2 className="text-sm font-bold text-[var(--text-primary)]">Pending Approval</h2><p className="text-[11px] text-slate-400 mt-0.5">AI and approval-based automations land here before they can send.</p></div></div><StatusPill text={`${pending.length} waiting`} tone="amber" /></div>
        {pending.length === 0 ? <p className="text-xs text-slate-400">Nothing is waiting for approval.</p> : <div className="space-y-4">{pending.map((draft) => <DraftCard key={draft.id} draft={draft} lists={lists} busy={isApprovalBusy} onApprove={(listId) => handleApprove(draft.id, listId)} onReject={() => handleReject(draft.id)} />)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6"><div className="flex items-center gap-2 mb-4"><Mail size={17} className="text-blue-400" /><h2 className="text-sm font-bold text-[var(--text-primary)]">Recent Brevo Campaigns</h2></div>{campaigns.length === 0 ? <p className="text-xs text-slate-400">No campaigns are available yet.</p> : <div className="space-y-2">{campaigns.map((campaign) => <div key={campaign.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="text-sm font-bold text-[var(--text-primary)]">{campaign.name}</p><p className="text-xs text-slate-400">{campaign.subject || "No subject"}</p></div><StatusPill text={campaign.status} tone="blue" /></div><p className="text-[10px] text-slate-500 mt-2">#{campaign.id} · {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString() : ""}</p></div>)}</div>}</section>
    </div>
  );
}

function DraftCard({ draft, lists, busy, onApprove, onReject }: { draft: Draft; lists: List[]; busy: boolean; onApprove: (listId?: number | null) => void; onReject: () => void }) {
  const sourceLabel = draft.source === "ai" ? "AI generated" : draft.source === "automation" ? "Automation" : "Manual";
  const audience = draft.listId ? (lists.find((list) => list.id === draft.listId)?.name ?? ("List #" + draft.listId)) : "Audience not selected";
  const [selectedListId, setSelectedListId] = useState<number | "">("");
  const needsAudience = draft.listId == null;
  return <article className="rounded-2xl border border-amber-500/20 bg-slate-950/20 p-4 sm:p-5"><div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill text={sourceLabel} tone="violet" />{needsAudience ? <StatusPill text={audience} tone="amber" /> : <StatusPill text={audience} tone="blue" />}{draft.status === "FAILED" && <StatusPill text="failed / retry" tone="red" />}</div>{needsAudience && <div className="mt-3 max-w-sm"><select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value ? Number(event.target.value) : "")} disabled={busy || lists.length === 0} className={CONTROL_INPUT}><option value="">Choose audience before sending</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></div>}<h3 className="text-base font-black text-[var(--text-primary)] mt-3">{draft.campaignName}</h3><p className="text-sm font-bold text-slate-200 mt-1">{draft.subject}</p>{draft.previewText && <p className="text-xs text-slate-500 mt-1">{draft.previewText}</p>}<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs text-slate-300 leading-6 whitespace-pre-wrap">{draft.body}</p>{draft.ctaLabel && <p className="text-xs text-emerald-400 mt-3 font-bold">CTA: {draft.ctaLabel}{draft.ctaUrl ? " → " + draft.ctaUrl : ""}</p>}</div>{draft.error && <p className="text-xs text-rose-400 mt-3">Last error: {draft.error}</p>}<p className="text-[10px] text-slate-500 mt-3">Created {new Date(draft.createdAt).toLocaleString()}</p></div><div className="flex lg:flex-col gap-2 shrink-0"><button type="button" onClick={() => onApprove(needsAudience ? selectedListId : draft.listId)} disabled={busy || (needsAudience && !selectedListId)} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><Send size={14} />Approve & Send</span></button><button type="button" onClick={onReject} disabled={busy || draft.status !== "DRAFT"} className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 text-xs font-bold px-4 py-3 disabled:opacity-50"><span className="inline-flex items-center gap-2"><XCircle size={14} />Reject</span></button></div></div></article>;
}
function StatusCard({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) { return <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] px-3 py-2.5"><div className={`flex items-center gap-1.5 text-[10px] font-bold ${ok ? "text-emerald-400" : "text-amber-400"}`}>{icon}{label}</div><p className="text-xs font-black text-[var(--text-primary)] mt-1">{value}</p></div>; }
function StatusPill({ text, tone }: { text: string; tone: "green" | "gray" | "blue" | "amber" | "violet" | "red" }) { const classes = { green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", gray: "bg-slate-500/10 text-slate-400 border-slate-500/20", blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", amber: "bg-amber-500/10 text-amber-400 border-amber-500/20", violet: "bg-violet-500/10 text-violet-400 border-violet-500/20", red: "bg-rose-500/10 text-rose-400 border-rose-500/20" } as const; return <span className={`text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1 border ${classes[tone]}`}>{text}</span>; }
function SetupItem({ label, ready }: { label: string; ready: boolean }) { return <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 bg-[var(--bg-surface)]"><div className="flex items-center gap-2"><span className={ready ? "text-emerald-400" : "text-rose-400"}>{ready ? "✓" : "•"}</span><span className="text-[10px] font-mono text-slate-400">{label}</span></div></div>; }
