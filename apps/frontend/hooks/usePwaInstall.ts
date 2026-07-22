"use client";

import { useState, useEffect } from "react";

let globalDeferredPrompt: any = null;

export function usePwaInstall() {
  const [isInstallable, setIsInstallable] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) {
      setIsInstalled(true);
      setChecked(true);
      return;
    }

    setChecked(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      globalDeferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    // 1. If Chrome has the event ready, trigger it instantly
    if (globalDeferredPrompt) {
      try {
        globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        globalDeferredPrompt = null;
      } catch (err) {
        console.error("Install prompt error:", err);
      }
      return;
    }

    // 2. Fallback: Programmatically select or highlight the text guidance block, 
    // or toggle a local UI state so your instructions element pulses or draws user attention.
    const guideElement = document.getElementById("pwa-install-instructions");
    if (guideElement) {
      guideElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      guideElement.classList.add("ring-2", "ring-primary", "transition-all");
      setTimeout(() => {
        guideElement.classList.remove("ring-2", "ring-primary");
      }, 2000);
    }
  };

  return { isInstallable, isInstalled, checked, install };
}