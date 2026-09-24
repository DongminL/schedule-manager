import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** FCM error codes meaning the token will never work again. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

let hasWarnedUnconfigured = false;

function getApp(): App | undefined {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return undefined;

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

/**
 * Send a data-only web push to every token (the service worker renders it).
 * Returns the tokens FCM rejected as permanently invalid. A no-op when the
 * Firebase credentials are not configured (local dev / tests).
 */
export async function sendToTokens(tokens: string[], payload: PushPayload): Promise<string[]> {
  const app = getApp();
  if (!app) {
    if (!hasWarnedUnconfigured) {
      hasWarnedUnconfigured = true;
      console.warn("[fcm] FIREBASE_* env not set; push notifications are disabled");
    }
    return [];
  }

  const res = await getMessaging(app).sendEachForMulticast({
    tokens,
    data: { title: payload.title, body: payload.body, url: payload.url },
    webpush: { headers: { Urgency: "high", TTL: "3600" } },
  });

  return res.responses.flatMap((r, i) =>
    !r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? [tokens[i]!] : [],
  );
}
