"use client";

import { useEffect, useMemo, useState } from "react";

type Draft = {
  id: string;
  title: string | null;
  platform: string;
  body: string;
  hashtags: string[];
  call_to_action: string | null;
  feature_focus: string | null;
  status: string;
  created_at: string;
};

type Connection = {
  id: string;
  provider: "facebook" | "instagram";
  account_name: string | null;
  status: string;
};

type Post = {
  id: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  failure_message: string | null;
  draft_title: string | null;
  account_name: string | null;
};

export default function MarketingManager() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState("Create content that makes business owners curious enough to open Garrison Market.");
  const [platform, setPlatform] = useState("both");
  const [featureFocus, setFeatureFocus] = useState("");
  const [scheduleFor, setScheduleFor] = useState<Record<string, string>>({});
  const [mediaFor, setMediaFor] = useState<Record<string, string>>({});
  const [connectionFor, setConnectionFor] = useState<Record<string, string>>({});

  const activeConnections = useMemo(
    () => connections.filter((item) => item.status === "active"),
    [connections],
  );

  async function load() {
    const [d, c, p] = await Promise.all([
      fetch("/api/admin/marketing/drafts?limit=30", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/marketing/meta/connections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/marketing/posts?limit=30", { cache: "no-store" }).then((r) => r.json()),
    ]);

    setDrafts(d.drafts || []);
    setConnections(c.connections || []);
    setPosts(p.posts || []);
  }

  useEffect(() => {
    load().catch(() => setStatus("Unable to load marketing data."));
  }, []);

  async function generate() {
    setLoading(true);
    setStatus("The Marketing Brain is creating fresh content...");
    try {
      const response = await fetch("/api/admin/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, goal, audience: "Nigerian small and growing business owners.", featureFocus: featureFocus || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      setStatus("Generated " + data.drafts.length + " new draft(s), focused on " + data.feature.name + ".");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    const response = await fetch("/api/admin/marketing/drafts/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const data = await response.json();
    if (!response.ok) setStatus(data.error || "Unable to approve draft.");
    else await load();
  }

  async function connectMeta() {
    window.location.href = "/api/admin/marketing/meta/connect?returnTo=/admin/marketing";
  }

  async function schedule(draft: Draft) {
    const connectionId = connectionFor[draft.id];
    const scheduledFor = scheduleFor[draft.id];

    if (!connectionId || !scheduledFor) {
      setStatus("Choose a social connection and future time first.");
      return;
    }

    try {
      const response = await fetch("/api/admin/marketing/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          connectionId,
          scheduledFor: new Date(scheduledFor).toISOString(),
          mediaUrls: mediaFor[draft.id]
            ? mediaFor[draft.id].split(",").map((value) => value.trim()).filter(Boolean)
            : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to schedule draft.");
      setStatus("Scheduled " + (draft.title || "post") + ".");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to schedule draft.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Garrison Market</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Marketing & Social Manager</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">AI-led content generation, approvals, scheduling, Meta publishing and marketing visibility in one mobile-first workspace.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={connectMeta} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">Connect Facebook / Instagram</button>
            <button onClick={load} className="rounded-xl border border-white/15 px-4 py-2 text-sm">Refresh</button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Create with the Marketing Brain</h2>
            <div className="mt-4 grid gap-3">
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm outline-none" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm">
                  <option value="both">Facebook + Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                </select>
                <input value={featureFocus} onChange={(e) => setFeatureFocus(e.target.value)} placeholder="Feature ID (optional)" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm outline-none" />
              </div>
              <button disabled={loading} onClick={generate} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                {loading ? "Generating..." : "Generate fresh content"}
              </button>
              {status && <p className="text-sm text-slate-300">{status}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Connections</h2>
            <div className="mt-3 space-y-2">
              {activeConnections.length === 0 ? (
                <p className="text-sm text-slate-400">No active Meta connection yet.</p>
              ) : activeConnections.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-black/20 p-3">
                  <div>
                    <p className="font-medium">{item.account_name || item.provider}</p>
                    <p className="text-xs uppercase text-slate-400">{item.provider}</p>
                  </div>
                  <span className="text-xs text-emerald-300">active</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Drafts</h2>
            <span className="text-xs text-slate-400">{drafts.length} loaded</span>
          </div>
          <div className="mt-3 space-y-3">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{draft.platform}</span><span>•</span><span>{draft.status}</span><span>•</span><span>{draft.feature_focus || "general"}</span>
                </div>
                <h3 className="mt-2 font-semibold">{draft.title || "Untitled draft"}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{draft.body}</p>
                {draft.hashtags?.length > 0 && <p className="mt-3 text-xs text-cyan-200">{draft.hashtags.join(" ")}</p>}
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr]">
                  {draft.status === "draft" && (
                    <button onClick={() => approve(draft.id)} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-200">Approve</button>
                  )}
                  {draft.status === "approved" && (
                    <>
                      <select
                        value={connectionFor[draft.id] || ""}
                        onChange={(event) => setConnectionFor((current) => ({ ...current, [draft.id]: event.target.value }))}
                        className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                      >
                        <option value="">Choose connection</option>
                        {activeConnections
                          .filter((connection) => connection.provider === draft.platform)
                          .map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              {connection.account_name || connection.provider}
                            </option>
                          ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={scheduleFor[draft.id] || ""}
                        onChange={(event) => setScheduleFor((current) => ({ ...current, [draft.id]: event.target.value }))}
                        className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                      />
                      <input
                        value={mediaFor[draft.id] || ""}
                        onChange={(event) => setMediaFor((current) => ({ ...current, [draft.id]: event.target.value }))}
                        placeholder="Public image/video URL (required for Instagram)"
                        className="sm:col-span-2 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs outline-none"
                      />
                      <button onClick={() => schedule(draft)} className="sm:col-span-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950">
                        Schedule post
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
            {drafts.length === 0 && <p className="text-sm text-slate-400">No drafts yet. Generate the first campaign asset above.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Publishing pipeline</h2>
            <span className="text-xs text-slate-400">{posts.length} recent posts</span>
          </div>
          <div className="mt-3 space-y-2">
            {posts.map((post) => (
              <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3 text-sm">
                <div>
                  <p className="font-medium">{post.draft_title || "Post"}</p>
                  <p className="text-xs text-slate-400">{post.platform} • {post.account_name || "connection"}{post.scheduled_for ? " • " + new Date(post.scheduled_for).toLocaleString() : ""}</p>
                  {post.failure_message && <p className="mt-1 text-xs text-rose-300">{post.failure_message}</p>}
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs">{post.status}</span>
              </div>
            ))}
            {posts.length === 0 && <p className="text-sm text-slate-400">Nothing scheduled or published yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
