"use client";

import { usePathname, useRouter } from "next/navigation";

import { Pagination } from "@/components/ui/Pagination";

/** Client-side page-nav wrapper — `ContactList` itself is a Server Component. */
export function ContactPagination({
  pageNo,
  totalPages,
}: {
  pageNo: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Pagination
      pageNo={pageNo}
      totalPages={totalPages}
      onNavigate={(n) => router.push(n > 1 ? `${pathname}?pageNo=${n}` : pathname)}
    />
  );
}
