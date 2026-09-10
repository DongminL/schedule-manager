import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/modules/auth";

import { AppHeader } from "./AppHeader";
import styles from "./app.module.scss";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        본문으로 건너뛰기
      </a>
      <AppHeader userName={session.user.name ?? ""} role={session.user.role} />
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
