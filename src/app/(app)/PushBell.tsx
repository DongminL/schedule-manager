"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { enablePush, isPushSupported, registerPush } from "@/lib/push";

import styles from "./app.module.scss";

/**
 * Keeps this device's push token registered for the logged-in user. Already
 * granted → registers silently on load. Not asked yet → shows a bell the user
 * taps to opt in (permission prompts need a user gesture).
 */
export function PushBell() {
  const [canAsk, setCanAsk] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission === "granted") {
      void registerPush();
    } else if (Notification.permission === "default") {
      // Browser-only permission state; unavailable during SSR. One-shot on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanAsk(true);
      // Prompt right away. Some browsers (iOS) reject it without a user gesture;
      // the bell stays as the manual fallback.
      void enablePush().then(() => setCanAsk(Notification.permission === "default"));
    }
  }, []);

  if (!canAsk) return null;

  async function handleEnable() {
    await enablePush();
    setCanAsk(Notification.permission === "default");
  }

  return (
    <button
      type="button"
      className={styles.logout}
      onClick={handleEnable}
      aria-label="알림 켜기"
      title="알림 켜기"
    >
      <Bell size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
