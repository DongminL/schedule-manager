/**
 * The single global UI store (PLAN sec.7 asks for Zustand). Holds the theme
 * preference and mirrors it onto <html data-theme> + localStorage so the
 * no-flash script in the root layout can restore it before paint.
 */
"use client";

import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_KEY = "theme";
const DEFAULT_THEME: Theme = "light";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark";
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/** Read the persisted preference. Call from a mount effect, never at init —
 *  the store must start deterministically (the default) to match SSR. */
export function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // private mode / storage disabled — in-memory only
    }
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
}));
