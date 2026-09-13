"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

import styles from "./PasswordInput.module.scss";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.wrap}>
      <input {...props} type={visible ? "text" : "password"} className={styles.input} />
      <button
        type="button"
        tabIndex={-1}
        className={styles.toggle}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {visible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
  );
}
