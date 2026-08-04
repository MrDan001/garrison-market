"use client";
// FILE: apps/frontend/components/AdminAnnouncementGate.tsx

import { useEffect, useState } from "react";
import AdminAnnouncementModal, { AdminAnnouncementMessage } from "./AdminAnnouncementModal";
import {
  getPendingAdminAnnouncementForRecipient,
  acknowledgeAdminMessageAction,
} from "@/lib/admin-message.actions";

/**
 * Mounted once near the root of the owner layout and the staff dashboard.
 * Fully self-contained — figures out who's logged in (owner or staff) and
 * what's pending for them server-side, so the same component works for
 * both roles without any props.
 *
 * On mount: fetch the oldest unacknowledged admin message, if any, and show
 * it as a pop-up. Acknowledging it writes the AdminMessageAck row (which is
 * what makes it show up as "Acknowledged" in /owner/messages or
 * /staff/messages) and immediately re-checks for another pending one — so a
 * recipient with several queued announcements sees them one at a time,
 * back-to-back, rather than needing to reload the page between each.
 */
export default function AdminAnnouncementGate() {
  const [message, setMessage] = useState<AdminAnnouncementMessage | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPendingAdminAnnouncementForRecipient().then((pending) => {
      if (!cancelled) {
        setMessage(pending);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAcknowledge() {
    if (!message) return;
    await acknowledgeAdminMessageAction(message.id);
    const next = await getPendingAdminAnnouncementForRecipient();
    setMessage(next);
  }

  if (!loaded || !message) return null;

  return <AdminAnnouncementModal message={message} onAcknowledge={handleAcknowledge} />;
}