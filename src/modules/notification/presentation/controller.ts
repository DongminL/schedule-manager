import { ok, readJson, route } from "@/core/http/envelope";
import { requireActiveUser } from "@/modules/auth/presentation/guards";

import { registerToken, unregisterToken } from "../application/notificationService";
import { tokenSchema } from "./schemas";

export const registerHandler = route(async (req) => {
  const user = await requireActiveUser();
  const { token } = await readJson(req, tokenSchema);
  await registerToken(user.id, token);
  return ok({ registered: true });
});

/**
 * Deliberately unauthenticated: it runs on logout / 401, when the session is
 * already gone. The unguessable FCM token itself is the credential.
 */
export const unregisterHandler = route(async (req) => {
  const { token } = await readJson(req, tokenSchema);
  await unregisterToken(token);
  return ok({ removed: true });
});
