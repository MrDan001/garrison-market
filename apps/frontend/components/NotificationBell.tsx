"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, ClipboardCheck, PackageX,
  Sparkles, Megaphone, Inbox, CheckCheck,
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationsEnabledRef = useRef(notificationsEnabled);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    customAudioRef.current = new Audio("/notification-sound.mp3");
    customAudioRef.current.volume = 1.0;
  }, []);

  // Handle clicks outside to close the floating dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const playAlarm = () => {
    if (!notificationsEnabledRef.current) return;
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

  const handleToggleOpen = async () => {
    const nextOpenState = !open;
    setOpen(nextOpenState);
    
    if (nextOpenState && unreadCount > 0) {
      await markAllNotificationsRead();
      prevUnreadRef.current = 0;
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const todayNotifs = notifications.filter((n) => isToday(n.createdAt));
  const earlierNotifs = notifications.filter((n) => !isToday(n.createdAt));

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={handleToggleOpen}
        className="relative flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {open && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 w-auto sm:w-96 bg-[#0d0f18] border border-slate-800/80 rounded-2xl z-50 flex flex-col shadow-2xl origin-top sm:origin-top-right transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bell size={14} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">Notifications</h2>
                <p className="text-[10px] text-slate-500">
                  {notifications.length === 0 ? "All caught up" : `${notifications.length} recent update${notifications.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto px-3 py-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                  <Inbox size={20} className="text-slate-700" />
                </div>
                <p className="text-xs font-semibold text-slate-300">Nothing here yet</p>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[180px]">
                  Updates and alerts will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayNotifs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1">Today</p>
                    <div className="space-y-1.5">
                      {todayNotifs.map((n) => (
                        <NotificationCard key={n.id} notification={n} />
                      ))}
                    </div>
                  </div>
                )}
                {earlierNotifs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1">Earlier</p>
                    <div className="space-y-1.5">
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
            <div className="px-4 py-2 border-t border-slate-800/60 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 bg-slate-950/40 rounded-b-2xl">
              <CheckCheck size={11} className="text-emerald-500" />
              All caught up
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ notification }: { notification: any }) {
  const config = typeConfig[notification.type as NotifType] ?? typeConfig.announcement;
  const Icon = config.icon;
  const isUnread = !notification.read;

  const content = (
    <div 
      className={`relative flex gap-3 p-3 rounded-xl transition-all duration-150 group
        ${isUnread 
          ? "bg-slate-900/90 border border-slate-700/80 hover:bg-slate-900 shadow-sm" 
          : "bg-slate-900/30 border border-slate-900/80 hover:border-slate-800 hover:bg-slate-900/50"
        }
      `}
    >
      {/* Unread dot indicator */}
      {isUnread && (
        <span className="absolute top-3.5 right-3 h-1.5 w-1.5 rounded-full bg-blue-400" />
      )}

      {/* Icon frame */}
      <div className={`h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
        <Icon size={15} className={config.text} />
      </div>

      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-wide ${config.text}`}>
            {config.label}
          </span>
          <span className="text-[9px] text-slate-600 shrink-0">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className={`text-xs leading-normal mt-1 ${isUnread ? "text-white font-medium" : "text-slate-400"}`}>
          {notification.message}
        </p>
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