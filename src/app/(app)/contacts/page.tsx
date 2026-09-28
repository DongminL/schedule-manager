import { Suspense } from "react";

import { ContactList } from "./ContactList";
import { ContactListSkeleton } from "./ContactListSkeleton";
import styles from "./contacts.module.scss";

export const dynamic = "force-dynamic";
export const metadata = { title: "연락처 · 알바 근무 일정 관리" };

type SearchParams = Promise<{ pageNo?: string }>;

function parsePageNo(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const pageNo = parsePageNo((await searchParams).pageNo);

  return (
    <section className={styles.wrap}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>연락처</h2>
        <span className={styles.hint}>일정 변경 전에 서로 연락해 조율하세요.</span>
      </div>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList pageNo={pageNo} />
      </Suspense>
    </section>
  );
}
