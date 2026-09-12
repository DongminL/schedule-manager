import { listContactDirectory } from "@/modules/account/application/accountService";
import { roleLabel } from "@/lib/roleLabel";

import styles from "./contacts.module.scss";

/** Streamed independently of the header — `listContactDirectory` may be slow. */
export async function ContactList() {
  const contacts = await listContactDirectory();

  if (contacts.length === 0) {
    return <p className={styles.empty}>등록된 사용자가 없습니다.</p>;
  }

  return (
    <ul className={styles.list}>
      {contacts.map((c) => (
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
  );
}
