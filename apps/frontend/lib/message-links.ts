// FILE: apps/frontend/lib/message-links.ts
//
// Admin message bodies can carry inline links using [label](url) syntax —
// e.g. "check your [dashboard](/owner/billing) for details". This is the
// one parser every surface that renders a message body reads from (the
// in-app MessageBody component, the pop-up modal, the email template, and
// list-preview stripping), so what counts as a link never drifts between
// them.

export type MessageSegment = { type: "text"; value: string } | { type: "link"; label: string; href: string };

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseMessageBody(body: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: "link", label: match[1], href: match[2] });
    lastIndex = LINK_PATTERN.lastIndex;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  return segments;
}

// "/owner/billing" -> internal (Next Link, client-side nav). "https://…" ->
// external (plain <a target="_blank">). Used by both the in-app renderer
// and the email template (which needs to resolve internal paths to an
// absolute URL since email has no app router to hand off to).
export function isInternalLink(href: string): boolean {
  return href.startsWith("/");
}

// List/preview surfaces truncate the raw body to ~120 chars — without this,
// a link near the cut-off point shows as literal "[dashboa" bracket syntax.
// Strips every [label](url) down to just its label so previews stay plain,
// readable text; the full body (with real links) still renders on the
// detail page itself.
export function stripMessageLinksForPreview(body: string): string {
  return body.replace(LINK_PATTERN, (_match, label: string) => label);
}

// Character ranges of every [label](url) span in the body — used by
// anything that splits/truncates the raw string by character count (e.g.
// the pop-up modal's slide splitter) so it can snap its cut point past a
// link instead of slicing through the middle of one.
export function getLinkRanges(body: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(body)) !== null) {
    ranges.push({ start: match.index, end: LINK_PATTERN.lastIndex });
  }
  return ranges;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The broadcast email's HTML body. Email has no app router to hand internal
// paths off to, so a "/owner/billing"-style href gets resolved to an
// absolute URL against baseUrl; external URLs pass through as-is. This is
// the one place a message body turns into raw HTML, so every text segment
// (and the link label/href themselves) goes through escapeHtml — nothing
// here skips escaping just because it came from inside a [label](url) span.
export function renderMessageBodyHtml(body: string, baseUrl: string): string {
  const segments = parseMessageBody(body);
  return segments
    .map((seg) => {
      if (seg.type === "text") return escapeHtml(seg.value).replace(/\n/g, "<br>");
      const href = isInternalLink(seg.href) ? `${baseUrl.replace(/\/$/, "")}${seg.href}` : seg.href;
      return `<a href="${escapeHtml(href)}" style="color:#4f46e5; font-weight:600;">${escapeHtml(seg.label)}</a>`;
    })
    .join("");
}