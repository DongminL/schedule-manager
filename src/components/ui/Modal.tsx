"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import styles from "./Modal.module.scss";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Minimal modal on the native <dialog> element — focus trap, Esc, and backdrop
 *  come for free. */
export function Modal({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
    >
      <div className={styles.head}>
        <h3>{title}</h3>
        <button type="button" onClick={onClose} aria-label="닫기">
          <X size={18} />
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
