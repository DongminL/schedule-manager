import { listContactDirectory } from "@/modules/account/application/accountService";
import { roleLabel } from "@/lib/roleLabel";

import styles from "./contacts.module.scss";

export const dynamic = "force-dynamic";
export const metadata = { title: "연락처 · 알바 근무 일정 관리" };

export default async function ContactsPage() {
  const contacts = await listContactDirectory();

  return (
    <section className={styles.wrap}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>연락처</h2>
        <span className={styles.hint}>일정 변경 전에 서로 연락해 조율하세요.</span>
      </div>

      {contacts.length === 0 ? (
        <p className={styles.empty}>등록된 사용자가 없습니다.</p>
      ) : (
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
      )}
    </section>
  );
}
