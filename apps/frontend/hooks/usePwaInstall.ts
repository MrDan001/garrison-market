"use client";

import { useState, useEffect } from "react";

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) {
      setIsInstalled(true);
      setChecked(true);
      return;
    }

    // Since your service worker & manifest are valid (confirmed by browser menu),
    // force the button to be available immediately so owners don't get stuck!
    setIsInstallable(true);
    setChecked(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    // If Chrome provided the live event, trigger it instantly
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    // If Chrome suppressed the live event on refresh, guide them cleanly or trigger browser menu
    if (typeof window !== "undefined") {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("To install Garrison Market on iOS, tap the Share button in your browser and select 'Add to Home Screen'.");
      } else {
        alert("To install Garrison Market, please click your browser menu (the three dots ⋮ in the top-right corner) and select 'Install Garrison Market...'.");
      }
    }
  };

  return { isInstallable, isInstalled, checked, install };
}