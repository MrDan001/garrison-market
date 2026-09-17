"use client";

import { FormEvent, useState, useTransition } from "react";
import { CheckCircle2, Mail, Send, Users, AlertTriangle, Plus } from "lucide-react";
import {
  addMarketingContactAction,
  sendMarketingCampaignAction,
} from "@/lib/marketing.actions";

type List = {
  id: number;
  name: string;
  totalSubscribers?: number;
  uniqueSubscribers?: number;
};

type Campaign = {
  id: number;
  name: string;
  status: string;
  subject?: string;
  sender?: { name?: string; email?: string };
  createdAt?: string;
  scheduledAt?: string;
  sentDate?: string;
};

type Props = {
  setup: { apiKey: boolean; senderEmail: boolean; marketingListId: boolean };
  lists: List[];
  campaigns: Campaign[];
  loadError: string | null;
};

export default function MarketingClient({ setup, lists, campaigns, loadError }: Props) {
  const [isAdding, startAdding] = useTransition();
  const [isSending, startSending] = useTransition();
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  const ready = setup.apiKey && setup.senderEmail && setup.marketingListId;

  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startAdding(async () => {
      const result = await addMarketingContactAction(formData);
      if (result.success) {
        setContactMessage("Contact added to the configured Brevo marketing list.");
        form.reset();
      } else {
        setContactMessage(result.error || "Could not add contact.");
      }
    });
  }

  function handleCampaignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    const confirmed = window.confirm(
      "Send this marketing campaign now to the selected Brevo list? This will immediately dispatch the campaign."
    );
    if (!confirmed) return;

    startSending(async () => {
      const result = await sendMarketingCampaignAction(formData);
      if (result.success) {
        setSendMessage(`Campaign sent successfully. Brevo campaign #${result.campaignId}.`);
        form.reset();
      } else {
        setSendMessage(result.error || "Could not send campaign.");
      }
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
          <Mail size={21} /> Marketing Email
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
          Brevo handles Garrison Market newsletters, product announcements, promotions, and other marketing email.
          Resend remains the transactional email provider for account and system messages.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {loadError}
        </div>
      )}

      {!ready && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-400 mt-0.5" size={18} />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Brevo setup is incomplete</h2>
              <p className="text-xs text-slate-400 mt-1">
                Add the required environment variables in the Garrison Market Vercel project before using this page.
              </p>
              <div className="grid sm:grid-cols-3 gap-2 mt-4 text-xs">
                <SetupItem label="BREVO_API_KEY" ready={setup.apiKey} />
                <SetupItem label="BREVO_SENDER_EMAIL" ready={setup.senderEmail} />
                <SetupItem label="BREVO_MARKETING_LIST_ID" ready={setup.marketingListId} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={17} className="text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Add Marketing Contact</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Adds a contact to the configured Brevo marketing list.</p>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-3">
            <input
              name="fullName"
              placeholder="Full name (optional)"
              disabled={!ready || isAdding}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email address"
              disabled={!ready || isAdding}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!ready || isAdding}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Plus size={15} /> {isAdding ? "Adding…" : "Add Contact"}
              </span>
            </button>
          </form>

          {contactMessage && <p className="text-xs text-slate-400 mt-3">{contactMessage}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Send Marketing Campaign</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Creates the campaign in Brevo and sends it immediately.</p>
            </div>
          </div>

          <form onSubmit={handleCampaignSubmit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                name="campaignName"
                required
                placeholder="Campaign name"
                disabled={!ready || isSending}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <select
                name="listId"
                defaultValue={setup.marketingListId ? String(process.env.NEXT_PUBLIC_UNUSED || "") : ""}
                disabled={!ready || isSending}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">Choose audience list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} — {list.uniqueSubscribers ?? list.totalSubscribers ?? 0} contacts
                  </option>
                ))}
              </select>
            </div>

            <input
              name="subject"
              required
              placeholder="Email subject"
              disabled={!ready || isSending}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <input
              name="previewText"
              placeholder="Preview text / preheader (optional)"
              disabled={!ready || isSending}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <textarea
              name="body"
              required
              rows={9}
              placeholder={'Write the marketing message here. Separate paragraphs with a blank line.\n\nYou can also personalize the greeting automatically.'}
              disabled={!ready || isSending}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 resize-y disabled:opacity-50"
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                name="ctaLabel"
                placeholder="CTA label (optional)"
                disabled={!ready || isSending}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <input
                name="ctaUrl"
                type="url"
                placeholder="https://gmstock.co/..."
                disabled={!ready || isSending}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            {sendMessage && <p className="text-xs text-slate-400">{sendMessage}</p>}

            <button
              type="submit"
              disabled={!ready || isSending}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-3 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                {isSending ? <CheckCircle2 size={15} /> : <Send size={15} />}
                {isSending ? "Sending…" : "Send Campaign Now"}
              </span>
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={17} className="text-blue-400" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent Brevo Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-400">No campaigns are available yet.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{campaign.name}</p>
                    <p className="text-xs text-slate-400">{campaign.subject || "No subject"}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {campaign.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  #{campaign.id} · {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString() : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SetupItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2">
        <span className={ready ? "text-emerald-400" : "text-rose-400"}>{ready ? "✓" : "•"}</span>
        <span className="text-[10px] font-mono text-slate-400">{label}</span>
      </div>
    </div>
  );
}
