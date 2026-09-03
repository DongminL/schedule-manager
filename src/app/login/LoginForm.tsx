"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./auth.module.scss";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", { phoneNumber, password, redirect: false });
    setPending(false);
    if (!res || res.error) {
      setError("휴대폰 번호 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <h1 className={styles.title}>로그인</h1>
      <p className={styles.subtitle}>매장 근무 일정 관리</p>

      <label className={styles.field}>
        <span>휴대폰 번호</span>
        <input
          name="phoneNumber"
          inputMode="numeric"
          autoComplete="username"
          placeholder="01012345678"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
