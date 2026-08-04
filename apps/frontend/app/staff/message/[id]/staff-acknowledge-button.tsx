"use client";
// FILE: apps/frontend/app/staff/messages/[id]/staff-acknowledge-button.tsx

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { acknowledgeAdminMessageAction } from "@/lib/admin-message.actions";

// The bell notification for an admin message links straight here, which
// means a staff member can land on this page without ever having seen the
// pop-up modal (e.g. it was on a different device, or already dismissed
// after being acknowledged elsewhere). This button covers that path so a
// message can never be stuck "pending" just because the pop-up wasn't the
// entry point this time.
export default function StaffAcknowledgeButton({
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
      <div className="w-full flex items-center justify-center gap-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-bold text-sm py-3 rounded-xl">
        <CheckCircle2 size={16} /> Acknowledged
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
      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
    >
      <CheckCircle2 size={16} />
      {isSubmitting ? "Acknowledging…" : "Acknowledged"}
    </button>
  );
}