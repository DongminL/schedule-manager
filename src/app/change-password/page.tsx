import { redirect } from "next/navigation";

import { auth } from "@/modules/auth";

import { ChangePasswordForm } from "./ChangePasswordForm";
import styles from "../login/auth.module.scss";

export const metadata = { title: "비밀번호 변경 · 알바 근무 일정 관리" };

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/change-password");
  if (!session.user.mustChangePassword) redirect("/");

  return (
    <main className={styles.page}>
      <ChangePasswordForm />
    </main>
  );
}
