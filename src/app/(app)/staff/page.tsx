import { redirect } from "next/navigation";

import {
  listStaffPage,
  STAFF_PAGE_SIZE,
} from "@/modules/account/application/accountService";
import type { PublicUser } from "@/modules/account/domain/user";
import { requirePageSession } from "@/modules/auth/presentation/guards";

import { parsePageNo } from "@/lib/pagination";

import { StaffTable, type StaffPageData, type StaffRow, type StaffTab } from "./StaffTable";

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

type SearchParams = Promise<{ tab?: string; pageNo?: string }>;

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageSession();
  if (user.role !== "MANAGER") redirect("/");

  const params = await searchParams;
  const tab: StaffTab = params.tab === "resigned" ? "resigned" : "active";
  const pageNo = parsePageNo(params.pageNo);

  const pagePromise: Promise<StaffPageData> = listStaffPage(tab === "active", pageNo).then(
    (p) => ({
      rows: p.rows.map(toRow),
      totalPages: Math.max(1, Math.ceil(p.total / STAFF_PAGE_SIZE)),
    }),
  );

  return <StaffTable pagePromise={pagePromise} tab={tab} pageNo={pageNo} />;
}
