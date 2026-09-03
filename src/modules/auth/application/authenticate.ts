import type { Role } from "@/core/db/schema";
import { verifyPassword } from "@/modules/account/infrastructure/passwordHasher";
import * as userRepo from "@/modules/account/infrastructure/userRepository";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export async function verifyCredentials(
  phoneNumber: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await userRepo.findByPhoneNumber(phoneNumber);
  if (!user || !user.isActive) return null;
  if (!(await verifyPassword(password, user.password))) return null;
  return {
    id: String(user.id),
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}
