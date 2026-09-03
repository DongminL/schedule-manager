"use client";

import { useEffect } from "react";

import styles from "./app.module.scss";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error("[app] segment error", error);
  }, [error]);

  return (
    <div className={styles.errorBox} role="alert">
      <h2>일정을 불러오지 못했습니다.</h2>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={() => reset()} className={styles.retry}>
        다시 시도
      </button>
    </div>
  );
}
