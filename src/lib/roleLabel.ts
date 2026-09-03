import type { Role } from "@/core/db/schema";

/** UI label for a user role. Single source for the 매니저/알바생 wording shared by
 *  the staff table, staff detail, and contacts screens. */
export function roleLabel(role: Role): string {
  return role === "MANAGER" ? "매니저" : "알바생";
}
