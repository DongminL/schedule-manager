import { redirect } from "next/navigation";

import { listStaff } from "@/modules/account/application/accountService";
import { requirePageSession } from "@/modules/auth/presentation/guards";

import { StaffTable, type StaffRow } from "./StaffTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "직원 관리 · 알바 근무 일정 관리" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const user = await requirePageSession();
  if (user.role !== "MANAGER") redirect("/");

  const showInactive = (await searchParams).inactive === "1";
  const rowsPromise: Promise<StaffRow[]> = listStaff(showInactive).then((list) =>
    list.map((u) => ({
      id: u.id,
      name: u.name,
      phoneNumber: u.phoneNumber,
      color: u.color,
      role: u.role,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
    })),
  );

  return <StaffTable rowsPromise={rowsPromise} showInactive={showInactive} />;
}
