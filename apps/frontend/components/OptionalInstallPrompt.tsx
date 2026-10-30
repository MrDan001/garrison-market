'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'garrison-install-prompt-dismissed-until';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function OptionalInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (standalone || dismissedUntil > Date.now()) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
    setIos(isIOS);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      timer = setTimeout(() => setVisible(true), 25000);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);
    if (isIOS) timer = setTimeout(() => setVisible(true), 25000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === 'accepted') dismiss();
      else setVisible(false);
      return;
    }
    if (ios) {
      window.alert('To add Garrison Market, tap the Share button in Safari, then choose “Add to Home Screen”.');
    }
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Add Garrison Market to your Home Screen"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-[var(--text-primary)] shadow-2xl"
    >
      <div className="min-w-0">
        <p className="font-semibold">Get quicker access</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Add Garrison Market to your Home Screen. You can keep using the website in your browser either way.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
        >
          Add to Home Screen
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1 text-sm text-[var(--text-secondary)]"
        >
          Maybe later
        </button>
      </div>
    </aside>
  );
}
