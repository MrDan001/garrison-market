"use client";

import { useState, useTransition } from "react";
import { Megaphone, Send } from "lucide-react";
import { sendAnnouncementAction } from "@/lib/notification.actions";

export default function OwnerAnnouncementForm() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  const handleSend = () => {
    if (!message.trim()) return;

    const formData = new FormData();
    formData.set("message", message.trim());

    startTransition(async () => {
      try {
        await sendAnnouncementAction(formData);
        setMessage("");
        setFeedback("success");
        setTimeout(() => setFeedback(null), 2500);
      } catch (err) {
        console.error("Failed to send announcement:", err);
        setFeedback("error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Send Announcement to Staff</h3>
      </div>
      <p className="text-xs text-slate-500">
        This appears as a notification for every staff member on your team.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Store closes early on Friday for stock-taking."
        className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-blue-600 transition-colors resize-none"
      />
      <button
        onClick={handleSend}
        disabled={isPending || !message.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold transition-colors"
      >
        <Send size={14} />
        {isPending ? "Sending..." : "Send to All Staff"}
      </button>
      {feedback === "success" && (
        <p className="text-xs text-emerald-400 text-center">Announcement sent.</p>
      )}
      {feedback === "error" && (
        <p className="text-xs text-rose-400 text-center">Something went wrong — try again.</p>
      )}
    </div>
  );
}