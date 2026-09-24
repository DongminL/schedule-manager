const TOKEN_KEY = "fcmToken";
const SW_PATH = "/firebase-messaging-sw.js";
const ENDPOINT = "/api/push-tokens";
const JSON_HEADERS = { "Content-Type": "application/json" };

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked (private mode): the token just won't be cleaned up client-side
  }
}

/** True only when running as an installed PWA (not in a regular browser tab). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true // IOS에서 PWA 판별
  );
}

/** Push is PWA-only so shared/public browsers never get a token registered. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    isStandalone() &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function firebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  const isComplete = Object.values(config).every(Boolean) && Boolean(vapidKey);
  return isComplete ? { config, vapidKey: vapidKey as string } : null;
}

/**
 * Get this browser's FCM token and make it the logged-in user's only token
 * (server side: last login wins). Requires notification permission already granted.
 */
export async function registerPush(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  const firebase = firebaseConfig();
  if (!firebase) return false;

  try {
    const [{ getApps, initializeApp }, { getMessaging, getToken, isSupported }] =
      await Promise.all([import("firebase/app"), import("firebase/messaging")]);
    if (!(await isSupported())) return false;

    const app = getApps()[0] ?? initializeApp(firebase.config);
    const registration = await navigator.serviceWorker.register(SW_PATH);
    const token = await getToken(getMessaging(app), {
      vapidKey: firebase.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;

    writeToken(token);
    return true;
  } catch (e) {
    console.error("[push] registration failed", e);
    return false;
  }
}

/**
 * Show the browser permission prompt if the PWA hasn't been asked yet. Must be
 * called synchronously from a user gesture (e.g. the login button click).
 */
export async function requestPushPermission(): Promise<NotificationPermission | null> {
  if (!isPushSupported() || Notification.permission !== "default") return null;
  return Notification.requestPermission();
}

/** Ask for notification permission (must come from a user gesture), then register. */
export async function enablePush(): Promise<boolean> {
  return (await requestPushPermission()) === "granted" && registerPush();
}

/**
 * Forget this device's token server-side. Keyed by token value, not session,
 * so it still works on logout and after the session has expired (401).
 */
export async function dropPushToken(): Promise<void> {
  const token = readToken();
  if (!token) return;
  writeToken(null);
  try {
    await fetch(ENDPOINT, {
      method: "DELETE",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
      keepalive: true,
    });
  } catch (e) {
    console.error("[push] token cleanup failed", e);
  }
}
