"use client";

import { useCallback, useEffect, useState } from "react";
import { saveSubscription, removeSubscription } from "@/lib/push.actions";

export type PushPermissionState = "unsupported" | "default" | "denied" | "granted";

// VAPID public key is safe to ship to the client — it's the whole point
// of NEXT_PUBLIC_ (baked in at build time), the private key never leaves
// the server. See scripts/generate-vapid-keys.ts to generate a pair.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY;

  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setPermission("unsupported");
      setChecked(true);
      return;
    }

    setPermission(Notification.permission as PushPermissionState);

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    } catch {
      setSubscribed(false);
    } finally {
      setChecked(true);
    }
  }, [isSupported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Navigate the currently-open tab when a background notification is
  // clicked — the service worker posts this message after focusing us.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "notification-click" && event.data?.link) {
        window.location.href = event.data.link;
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return false;

    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);
      if (result !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await saveSubscription(subscription.toJSON() as any, navigator.userAgent);
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe failed:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    checked,
    permission,
    subscribed,
    busy,
    subscribe,
    unsubscribe,
  };
}