"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { readStoredTheme, useUiStore } from "@/stores/uiStore";

import styles from "./ThemeToggle.module.scss";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  // The store starts at the default to match SSR; adopt the saved preference
  // once mounted so server/client markup agree during hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Mount-only hydration sync: adopt the persisted theme once the client
    // is live (localStorage is unavailable during SSR). One-shot, not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setTheme(readStoredTheme());
  }, [setTheme]);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      className={`${styles.toggle} ${isDark ? styles.dark : ""}`}
      onClick={toggleTheme}
      aria-label={isDark ? "다크 모드 · 클릭하면 라이트" : "라이트 모드 · 클릭하면 다크"}
      title={isDark ? "다크 모드 · 클릭하면 라이트" : "라이트 모드 · 클릭하면 다크"}
    >
      <span className={styles.track}>
        <Sun className={styles.iconSun} size={13} strokeWidth={2.2} />
        <Moon className={styles.iconMoon} size={13} strokeWidth={2.2} />
        <span className={styles.knob} />
      </span>
    </button>
  );
}
