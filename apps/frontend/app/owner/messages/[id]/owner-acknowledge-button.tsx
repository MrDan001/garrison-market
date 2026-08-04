"use client";
// FILE: apps/frontend/app/owner/messages/[id]/owner-acknowledge-button.tsx

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { acknowledgeAdminMessageAction } from "@/lib/admin-message.actions";

// Covers the case where an owner reaches this page without ever seeing the
// pop-up modal (e.g. via the bell notification link, or on a different
// device) — same reasoning as the staff equivalent of this button.
export default function OwnerAcknowledgeButton({
  messageId,
  isAcknowledged,
}: {
  messageId: number;
  isAcknowledged: boolean;
}) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(isAcknowledged);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (acknowledged) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
        <CheckCircle2 size={13} /> Acknowledged
      </div>
    );
  }

  async function handleClick() {
    setIsSubmitting(true);
    try {
      const result = await acknowledgeAdminMessageAction(messageId);
      if (result.success) {
        setAcknowledged(true);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500 hover:text-blue-600 disabled:opacity-60 transition-colors"
    >
      <CheckCircle2 size={13} />
      {isSubmitting ? "Acknowledging…" : "Mark as Acknowledged"}
    </button>
  );
}