"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, CalendarDays, LogOut, Phone, Users, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import type { Role } from "@/core/db/schema";

import styles from "./app.module.scss";

type NavItem = { href: string; label: string; Icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "캘린더", Icon: CalendarDays },
  { href: "/requests", label: "변경요청", Icon: ArrowLeftRight },
  { href: "/contacts", label: "연락처", Icon: Phone },
];

const MANAGER_NAV: NavItem = { href: "/staff", label: "직원 관리", Icon: Users };

/* how long the indicator's stretch-and-settle morph runs (matches --dur-slow + slack) */
const MORPH_MS = 420;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppHeader({ userName, role }: { userName: string; role: Role }) {
  const pathname = usePathname();
  const items = role === "MANAGER" ? [...NAV, MANAGER_NAV] : NAV;
  const activeIndex = items.findIndex((item) => isActive(pathname, item.href));

  // flag the indicator as "moving" for one morph cycle whenever the active tab changes
  const [isMoving, setIsMoving] = useState(false);
  const prevIndex = useRef(activeIndex);
  useEffect(() => {
    if (prevIndex.current === activeIndex) return;
    prevIndex.current = activeIndex;
    setIsMoving(true);
    const id = setTimeout(() => setIsMoving(false), MORPH_MS);
    return () => clearTimeout(id);
  }, [activeIndex]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.brand}>
            근무 일정
          </Link>

          <nav className={styles.nav} aria-label="주요 메뉴">
            {items.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={isActive(pathname, href) ? styles.navActive : undefined}
              >
                {label}
              </Link>
            ))}
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
              <LogOut size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <nav
        className={styles.tabBar}
        aria-label="하단 탭 메뉴"
        style={
          {
            "--tab-count": items.length,
            "--active-index": Math.max(activeIndex, 0),
          } as CSSProperties
        }
      >
        <span
          className={styles.tabIndicator}
          data-hidden={activeIndex < 0 ? "true" : undefined}
          data-moving={isMoving ? "true" : undefined}
          aria-hidden="true"
        />
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={styles.tab}
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
