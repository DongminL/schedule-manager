import { redirect } from "next/navigation";

import { listStaff } from "@/modules/account/application/accountService";
import type { PublicUser } from "@/modules/account/domain/user";
import { requirePageSession } from "@/modules/auth/presentation/guards";

import { StaffTable, type StaffGroups, type StaffRow } from "./StaffTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "직원 관리 · 알바 근무 일정 관리" };

function toRow(u: PublicUser): StaffRow {
  return {
    id: u.id,
    name: u.name,
    phoneNumber: u.phoneNumber,
    color: u.color,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    updatedAt: u.updatedAt.toISOString(),
  };
}

export default async function StaffPage() {
  const user = await requirePageSession();
  if (user.role !== "MANAGER") redirect("/");

  const rowsPromise: Promise<StaffGroups> = listStaff().then((groups) => ({
    active: groups.active.map(toRow),
    resigned: groups.resigned.map(toRow),
  }));

  return <StaffTable rowsPromise={rowsPromise} />;
}
