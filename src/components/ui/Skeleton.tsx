import type { CSSProperties } from "react";

import styles from "./Skeleton.module.scss";

/** Pulsing placeholder block used in route `loading.tsx` files. */
export function Skeleton({ style }: { style?: CSSProperties }) {
  return <div className={styles.pulse} style={style} />;
}
