"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ExternalLink, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

export type AdminAnnouncementMessage = {
  id: number;
  subject: string;
  body: string;
  link?: string | null;
  imageUrl?: string | null;
  createdAt: string | Date;
};

// Short messages render as a single slide, unchanged. Long ones get broken
// into 2-3 roughly equal chunks by length, snapped forward to the next
// whitespace so a word never gets cut in half. Deliberately length-based
// rather than paragraph-based, per product decision — a simple, predictable
// split rather than depending on how the admin happened to format line
// breaks when composing.
const SINGLE_SLIDE_MAX_CHARS = 220;
const TWO_SLIDE_MAX_CHARS = 450;

function splitBodyIntoSlides(body: string): string[] {
  const trimmed = body.trim();
  if (trimmed.length <= SINGLE_SLIDE_MAX_CHARS) return [trimmed];

  const slideCount = trimmed.length <= TWO_SLIDE_MAX_CHARS ? 2 : 3;
  const target = Math.ceil(trimmed.length / slideCount);

  const slides: string[] = [];
  let start = 0;
  for (let i = 0; i < slideCount; i++) {
    if (i === slideCount - 1) {
      slides.push(trimmed.slice(start).trim());
      break;
    }
    let end = Math.min(start + target, trimmed.length);
    while (end < trimmed.length && trimmed[end] !== " " && trimmed[end] !== "\n") end++;
    slides.push(trimmed.slice(start, end).trim());
    start = end;
  }
  return slides.filter((s) => s.length > 0);
}

/**
 * The pop-up an owner/staff sees when the admin broadcasts an announcement
 * (system update, upgrade notice, etc). Deliberately framed as coming from
 * a person/team — "Admin Desk" — rather than a generic system toast, per
 * product decision. Three-part layout:
 *   Header — "Message from the Admin Desk" badge + subject (fixed, same on
 *            every slide)
 *   Body   — center-aligned message text, paginated into 2-3 slides when
 *            long; the attached image (if any) only shows on the first
 *            slide, the link (if any) only on the last
 *   Footer — Back/Next when there's more than one slide, "Acknowledged"
 *            gated to the LAST slide only (per product decision — reading
 *            through everything is required before acknowledging), plus
 *            sender signature/timestamp
 *
 * This component is purely presentational — it doesn't know how to fetch
 * the next pending message or persist the acknowledgment; the caller
 * passes the message in and handles onAcknowledge. No reply/response
 * affordance exists here or ever should — this is strictly a one-way
 * broadcast. (The separate in-app reply thread lives entirely on the
 * owner's /owner/messages/[id] mailbox page, not here.)
 */
export default function AdminAnnouncementModal({
  message,
  onAcknowledge,
}: {
  message: AdminAnnouncementMessage;
  onAcknowledge: () => void | Promise<void>;
}) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(() => splitBodyIntoSlides(message.body), [message.body]);
  const isMultiSlide = slides.length > 1;
  const isLastSlide = slideIndex === slides.length - 1;
  const isFirstSlide = slideIndex === 0;

  // A fresh message (after acknowledging the previous one) always starts
  // back at slide 0 — without this, chaining straight into the next
  // pending message would keep whatever slide index the last one ended on.
  useEffect(() => {
    setSlideIndex(0);
  }, [message.id]);

  async function handleAcknowledge() {
    if (isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      await onAcknowledge();
    } finally {
      setIsAcknowledging(false);
    }
  }

  const sentAt = new Date(message.createdAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-announcement-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-900 text-center">
          <div className="h-11 w-11 rounded-full bg-blue-600/10 flex items-center justify-center">
            <ShieldCheck size={20} className="text-blue-500" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-500">
            Message from the Admin Desk
          </span>
          <h2 id="admin-announcement-title" className="text-base font-bold text-[var(--text-primary)] leading-snug">
            {message.subject}
          </h2>
        </div>

        {/* Body — center aligned */}
        <div className="px-6 py-5 flex flex-col items-center text-center gap-4">
          {message.imageUrl && isFirstSlide && (
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={message.imageUrl} alt="" className="w-full max-h-56 object-cover" />
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
            {slides[slideIndex]}
          </p>

          {message.link && isLastSlide && (
            <a
              href={message.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
            >
              Learn more <ExternalLink size={12} />
            </a>
          )}

          {/* Slide dots */}
          {isMultiSlide && (
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slideIndex ? "w-4 bg-blue-500" : "w-1.5 bg-slate-300 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-1 flex flex-col items-center gap-3">
          {isLastSlide ? (
            <div className="w-full flex items-center gap-2">
              {isMultiSlide && (
                <button
                  onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <button
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
              >
                <CheckCircle2 size={16} />
                {isAcknowledging ? "Acknowledging…" : "Acknowledged"}
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center gap-2">
              <button
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                disabled={isFirstSlide}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Garrison Market Admin Team · {sentAt}
          </p>
        </div>
      </div>
    </div>
  );
}