import styles from "./app.module.scss";

/** Shown while the calendar page awaits its data on the server. */
export default function Loading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="불러오는 중">
      <div className={styles.loadingBar} style={{ width: "40%" }} />
      <div className={styles.loadingGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={styles.loadingCell} />
        ))}
      </div>
    </div>
  );
}
