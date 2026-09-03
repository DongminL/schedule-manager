"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiSend } from "@/lib/api";

import styles from "../login/auth.module.scss";

export function ChangePasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setPending(true);
    try {
      await apiSend("POST", "/api/account/change-password", { newPassword });
      await update({ mustChangePassword: false });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "변경에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <h1 className={styles.title}>비밀번호 변경</h1>
      <p className={styles.subtitle}>최초 로그인 시 비밀번호를 변경해야 합니다.</p>

      <label className={styles.field}>
        <span>새 비밀번호 (8자 이상)</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span>새 비밀번호 확인</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "변경 중…" : "변경하고 계속"}
      </button>
    </form>
  );
}
