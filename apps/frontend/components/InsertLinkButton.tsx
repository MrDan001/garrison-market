"use client";
// FILE: apps/frontend/components/InsertLinkButton.tsx

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";

// Small "Insert link" affordance that sits under a message-body textarea.
// Wraps the current text selection (or a placeholder, if nothing's
// selected) in [label](url) syntax and splices it into the body at the
// cursor — the same syntax MessageBody/the email template read on the way
// out, so admin never has to type the brackets by hand. Shared by both
// compose routes (owners + staff) so the insertion behavior never drifts
// between them.
export default function InsertLinkButton({
  textareaRef,
  body,
  setBody,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  body: string;
  setBody: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  function openForm() {
    const el = textareaRef.current;
    const selected = el ? body.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : "";
    setLabel(selected);
    setUrl("");
    setOpen(true);
  }

  function insert() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const trimmedLabel = label.trim() || trimmedUrl;

    const el = textareaRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const markdown = `[${trimmedLabel}](${trimmedUrl})`;
    const next = body.slice(0, start) + markdown + body.slice(end);

    setBody(next);
    setOpen(false);
    setLabel("");
    setUrl("");

    // Land the cursor right after the inserted link, once the textarea's
    // value has actually updated to the new body on the next paint.
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + markdown.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={openForm}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors"
      >
        <LinkIcon size={13} /> Insert link
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
          <input
            type="text"
            placeholder="Text to show (e.g. your dashboard)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="https://… or an in-app path like /owner/billing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={insert}
              disabled={!url.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg py-2 transition-colors"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-[var(--text-primary)] px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}