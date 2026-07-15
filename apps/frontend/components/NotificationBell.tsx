"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, X, ClipboardCheck, ClipboardX, PackageX,
  PackageCheck as PackageCheckIcon, Sparkles, Megaphone, Inbox, CheckCheck,
} from "lucide-react";
import { getNotificationsForStaff, markAllNotificationsRead } from "@/lib/notification.actions";

type NotifType = "report_status" | "low_stock" | "new_item" | "announcement";

const typeConfig: Record<NotifType, { icon: any; bg: string; text: string; label: string }> = {
  report_status: { icon: ClipboardCheck, bg: "bg-blue-500/10", text: "text-blue-400", label: "Report" },
  low_stock: { icon: PackageX, bg: "bg-amber-500/10", text: "text-amber-400", label: "Stock Alert" },
  new_item: { icon: Sparkles, bg: "bg-emerald-500/10", text: "text-emerald-400", label: "New Item" },
  announcement: { icon: Megaphone, bg: "bg-purple-500/10", text: "text-purple-400", label: "Announcement" },
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function NotificationBell({ notificationsEnabled }: { notificationsEnabled: boolean }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevUnreadRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    customAudioRef.current = new Audio("/notification-sound.mp3");
    customAudioRef.current.volume = 1.0;
  }, []);

  const playAlarm = () => {
    if (!notificationsEnabled) return;
    const custom = customAudioRef.current;
    if (custom) {
      custom.currentTime = 0;
      custom.play().catch(() => playSynthesizedAlarm());
      return;
    }
    playSynthesizedAlarm();
  };

  const playSynthesizedAlarm = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      const ctx = audioCtxRef.current;
      const tones = [1046, 784];
      let t = ctx.currentTime;
      for (let r = 0; r < 3; r++) {
        for (const freq of tones) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
          t += 0.2;
        }
      }
    } catch {}
  };

  const fetchNotifications = async () => {
    const { notifications, unreadCount } = await getNotificationsForStaff();
    if (unreadCount > prevUnreadRef.current) playAlarm();
    prevUnreadRef.current = unreadCount;
    setNotifications(notifications);
    setUnreadCount(unreadCount);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    setOpen(true);
    if (unreadCount > 0) {
      await markAllNotificationsRead();
      prevUnreadRef.current = 0;
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const todayNotifs = notifications.filter((n) => isToday(n.createdAt));
  const earlierNotifs = notifications.filter((n) => !isToday(n.createdAt));

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full sm:max-w-md sm:mx-4 bg-[#0d0f18] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl z-10 max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl">
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Bell size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Notifications</h2>
                  <p className="text-[11px] text-slate-500">
                    {notifications.length === 0 ? "You're all caught up" : `${notifications.length} recent update${notifications.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                    <Inbox size={28} className="text-slate-700" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Nothing here yet</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-[220px]">
                    Report updates, stock alerts, and announcements will show up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {todayNotifs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Today</p>
                      <div className="space-y-2">
                        {todayNotifs.map((n) => (
                          <NotificationCard key={n.id} notification={n} />
                        ))}
                      </div>
                    </div>
                  )}
                  {earlierNotifs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Earlier</p>
                      <div className="space-y-2">
                        {earlierNotifs.map((n) => (
                          <NotificationCard key={n.id} notification={n} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <CheckCheck size={13} className="text-emerald-500" />
                All notifications marked as read
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NotificationCard({ notification }: { notification: any }) {
  const config = typeConfig[notification.type as NotifType] ?? typeConfig.announcement;
  const Icon = config.icon;

  const content = (
    <div className="flex gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
      <div className={`h-10 w-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
        <Icon size={17} className={config.text} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${config.text}`}>{config.label}</span>
          <span className="text-[10px] text-slate-600 shrink-0">{timeAgo(notification.createdAt)}</span>
        </div>
        <p className="text-xs text-slate-200 leading-snug mt-1">{notification.message}</p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <a href={notification.link} className="block">
        {content}
      </a>
    );
  }

  return content;
}