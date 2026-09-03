import type { UserRow } from "./tables";

/** A user row with the password hash stripped — safe to return from the API. */
export type PublicUser = Omit<UserRow, "password">;

export function toPublicUser(row: UserRow): PublicUser {
  // Strip the password hash; `rest` is the public projection.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = row;
  return rest;
}
