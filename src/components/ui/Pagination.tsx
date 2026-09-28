import styles from "./Pagination.module.scss";

interface PaginationProps {
  pageNo: number;
  totalPages: number;
  onNavigate: (pageNo: number) => void;
}

const BLOCK_SIZE = 5;

/**
 * Page-number pagination control. Renders nothing when everything fits on one page.
 * Number buttons are windowed in blocks of `BLOCK_SIZE` (1–5, then 6–10, ...) so a
 * large `totalPages` doesn't render one button per page.
 */
export function Pagination({ pageNo, totalPages, onNavigate }: PaginationProps) {
  if (totalPages <= 1) return null;

  const blockStart = Math.floor((pageNo - 1) / BLOCK_SIZE) * BLOCK_SIZE + 1;
  const blockEnd = Math.min(blockStart + BLOCK_SIZE - 1, totalPages);
  const blockPages = Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i);

  return (
    <nav className={styles.wrap} aria-label="페이지네이션">
      <button
        type="button"
        className={styles.nav}
        disabled={pageNo <= 1}
        onClick={() => onNavigate(pageNo - 1)}
      >
        이전
      </button>
      {blockPages.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === pageNo || undefined}
          className={n === pageNo ? styles.pageActive : styles.page}
          onClick={() => onNavigate(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={styles.nav}
        disabled={pageNo >= totalPages}
        onClick={() => onNavigate(pageNo + 1)}
      >
        다음
      </button>
    </nav>
  );
}
