"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import type { Role } from "@/core/db/schema";

import styles from "./app.module.scss";

export function AppHeader({ userName, role }: { userName: string; role: Role }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          근무 일정
        </Link>

        <nav className={styles.nav}>
          <Link href="/">캘린더</Link>
          <Link href="/requests">변경요청</Link>
          <Link href="/contacts">연락처</Link>
          {role === "MANAGER" && <Link href="/staff">직원 관리</Link>}
        </nav>

        <div className={styles.right}>
          <span className={styles.user}>{userName}</span>
          <ThemeToggle />
          <button
            type="button"
            className={styles.logout}
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="로그아웃"
            title="로그아웃"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
