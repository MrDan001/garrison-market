"use client";
// FILE: apps/frontend/app/admin/messages/messages-client.tsx

import Link from "next/link";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { withTimeout } from "@/lib/with-timeout";
import { sendAdminMessageAction } from "@/lib/admin-message.actions";
import { Send, Image as ImageIcon, Link as LinkIcon, X, Users, User, CheckCircle2, MessageCircle } from "lucide-react";

type Owner = { id: number; fullName: string | null; storeName: string | null; email: string };
type SentMessage = {
  id: number;
  subject: string;
  audience: string;
  targetOwnerName: string | null;
  createdAt: Date;
  readCount: number;
  recipientCount: number;
  replyCount: number;
  pendingReplyCount: number;
};

export default function MessagesClient({ owners, initialSent }: { owners: Owner[]; initialSent: SentMessage[] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"all_owners" | "single_owner">("all_owners");
  const [targetOwnerId, setTargetOwnerId] = useState<number | "">("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(initialSent);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!subject.trim() || !body.trim()) {
      setError("Subject and message body are required.");
      return;
    }
    if (audience === "single_owner" && !targetOwnerId) {
      setError("Pick an owner to send this to.");
      return;
    }

    setIsSending(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setStatus("Optimizing image...");
        const compressed = await compressImage(imageFile, { maxDimension: 1200, quality: 0.85 });
        setStatus("Uploading image...");
        const blob = await withTimeout(
          upload(compressed.name, compressed, { access: "public", handleUploadUrl: "/api/blob/upload" }),
          30000,
          "Image upload timed out. Check your connection and try again."
        );
        imageUrl = blob.url;
      }

      setStatus("Sending...");
      const result = await sendAdminMessageAction({
        subject: subject.trim(),
        body: body.trim(),
        link: link.trim() || undefined,
        imageUrl,
        audience,
        targetOwnerId: audience === "single_owner" ? Number(targetOwnerId) : undefined,
      });

      if (!result.success) {
        setError(result.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccessMsg(
        `Sent to ${result.recipientCount} owner${result.recipientCount === 1 ? "" : "s"}` +
          (result.emailFailures ? ` (${result.emailFailures} email${result.emailFailures === 1 ? "" : "s"} failed to send)` : "")
      );

      // Optimistically prepend to the sent list — good enough for a
      // reference log; a hard refresh will re-sync exact read counts.
      setSent((prev) => [
        {
          id: result.messageId,
          subject: subject.trim(),
          audience,
          targetOwnerName:
            audience === "single_owner"
              ? owners.find((o) => o.id === Number(targetOwnerId))?.fullName ?? null
              : null,
          createdAt: new Date(),
          readCount: 0,
          recipientCount: result.recipientCount,
          replyCount: 0,
          pendingReplyCount: 0,
        },
        ...prev,
      ]);

      setSubject("");
      setBody("");
      setLink("");
      removeImage();
      setAudience("all_owners");
      setTargetOwnerId("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
      setStatus("");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-24 max-w-3xl mx-auto space-y-8">
      {/* Compose */}
      <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Compose a Message</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Audience */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudience("all_owners")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                audience === "all_owners"
                  ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <Users size={14} /> All Owners
            </button>
            <button
              type="button"
              onClick={() => setAudience("single_owner")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                audience === "single_owner"
                  ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <User size={14} /> Specific Owner
            </button>
          </div>

          {audience === "single_owner" && (
            <select
              value={targetOwnerId}
              onChange={(e) => setTargetOwnerId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select an owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName || o.email} {o.storeName ? `— ${o.storeName}` : ""}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500"
          />

          <textarea
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />

          <div className="relative">
            <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              placeholder="Link (optional) — https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {imagePreview ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-3 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-400 transition-colors"
            >
              <ImageIcon size={14} /> Attach an image (optional)
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          {successMsg && (
            <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {isSending ? (status || "Sending…") : (<><Send size={15} /> Send Message</>)}
          </button>
        </form>
      </div>

      {/* Sent history */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Recently Sent</h2>
        {sent.length === 0 ? (
          <p className="text-xs text-slate-500">No messages sent yet.</p>
        ) : (
          <div className="space-y-2">
            {sent.map((m) => (
              <Link
                key={m.id}
                href={`/admin/messages/${m.id}`}
                className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:border-blue-400/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.audience === "single_owner" ? `To ${m.targetOwnerName || "one owner"}` : "To all owners"}
                    {" · "}
                    {new Date(m.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.pendingReplyCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-indigo-500 text-white rounded-full px-2 py-1">
                      <MessageCircle size={11} /> {m.pendingReplyCount}
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-400">{m.readCount}/{m.recipientCount} read</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}