// FILE: apps/frontend/app/affiliate/CopyLinkButton.tsx

"use client";

import { useState } from "react";

export default function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`https://gmstock.co/ref/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="bg-[var(--text-primary)] text-[var(--bg-app)] px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-85 transition"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}