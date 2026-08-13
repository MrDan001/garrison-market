// FILE: apps/frontend/components/MessageBody.tsx

import Link from "next/link";
import { parseMessageBody, isInternalLink, isSafeExternalLink } from "@/lib/message-links";

// Renders an admin message body with inline [label](url) links turned into
// real, clickable links — internal app paths ("/owner/billing") navigate
// client-side via next/link, external URLs open in a new tab. Used
// everywhere a message body is shown: the mailbox detail pages, the pop-up
// modal, and admin's own preview of what they sent.
//
// Only ever returns inline content (a <span> wrapping text/link spans) —
// no block-level wrapper of its own. The caller's own container keeps
// whatever whitespace-pre-wrap / whitespace-pre-line it already had for
// line breaks; this component just swaps the link segments in place.
export default function MessageBody({ text }: { text: string }) {
  const segments = parseMessageBody(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : isInternalLink(seg.href) ? (
          <Link
            key={i}
            href={seg.href}
            className="text-blue-500 hover:text-blue-600 font-semibold underline underline-offset-2"
          >
            {seg.label}
          </Link>
        ) : isSafeExternalLink(seg.href) ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 font-semibold underline underline-offset-2"
          >
            {seg.label}
          </a>
        ) : (
          // Unsafe scheme (javascript:, data:, etc.) — show the label as
          // plain text rather than a clickable link.
          <span key={i}>{seg.label}</span>
        )
      )}
    </>
  );
}