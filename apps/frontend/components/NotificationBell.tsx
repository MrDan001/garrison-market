"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { getNotificationsForStaff, markAllNotificationsRead } from "@/lib/notification.actions";

const typeIcons: Record<string, string> = {
  report_status: "📋",
  low_stock: "📦",
  new_item: "🆕",
  announcement: "📣",
};

export default function NotificationBell({ notificationsEnabled }: { notificationsEnabled: boolean }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const prevUnreadRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    if (!notificationsEnabled) return; // muted per preference, bell/badge still updates visually
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Browser blocked audio before first user interaction — fail silently
    }
  };

  const fetchNotifications = async () => {
    const { notifications, unreadCount } = await getNotificationsForStaff();
    if (unreadCount > prevUnreadRef.current) {
      playBeep();
    }
    prevUnreadRef.current = unreadCount;
    setNotifications(notifications);
    setUnreadCount(unreadCount);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000); // 12s poll
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    const opening = !open;
    setOpen(opening);
    if (opening && unreadCount > 0) {
      await markAllNotificationsRead();
      prevUnreadRef.current = 0;
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-[#11131A] border border-slate-800 rounded-2xl shadow-xl z-50">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 flex gap-2.5">
                    <span className="text-base shrink-0">{typeIcons[n.type] ?? "🔔"}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-200 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(n.createdAt).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}