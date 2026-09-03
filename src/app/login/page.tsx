import { redirect } from "next/navigation";

import { auth } from "@/modules/auth";

import { LoginForm } from "./LoginForm";
import styles from "./auth.module.scss";

export const metadata = { title: "로그인 · 알바 근무 일정 관리" };

function safePath(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const callbackUrl = safePath((await searchParams).callbackUrl);
  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <main className={styles.page}>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
