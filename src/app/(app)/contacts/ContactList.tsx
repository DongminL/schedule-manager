import {
  CONTACT_PAGE_SIZE,
  listContactDirectoryPage,
} from "@/modules/account/application/accountService";
import { roleLabel } from "@/lib/roleLabel";

import { ContactPagination } from "./ContactPagination";
import styles from "./contacts.module.scss";

/** Streamed independently of the header — `listContactDirectoryPage` may be slow. */
export async function ContactList({ pageNo }: { pageNo: number }) {
  const { rows, total } = await listContactDirectoryPage(pageNo);

  return (
    <>
      {rows.length === 0 ? (
        <p className={styles.empty}>등록된 사용자가 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((c) => (
            <li key={c.id} className={styles.card}>
              <div className={styles.who}>
                <strong>{c.name}</strong>
                <span className={styles.role}>{roleLabel(c.role)}</span>
              </div>
              <div className={styles.actions}>
                <a href={`tel:${c.phoneNumber}`} className={styles.phone}>
                  {c.phoneNumber}
                </a>
                <a
                  href={`sms:${c.phoneNumber}`}
                  className={styles.sms}
                  aria-label={`${c.name}에게 문자 보내기`}
                >
                  문자
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ContactPagination
        pageNo={pageNo}
        totalPages={Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE))}
      />
    </>
  );
}
