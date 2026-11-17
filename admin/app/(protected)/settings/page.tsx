import Link from "next/link";
import { PageHeader } from "../../../src/ui/shared/PageHeader";
import styles from "../../../src/ui/settings/settings.module.css";

export default function SettingsPage() {
  return (
    <main className={styles.page}>
      <PageHeader title="설정·운영" />
      <nav className={styles.links}>
        <Link href="/settings/app-version">앱 버전 정책</Link>
        <Link href="/settings/operation-policy">운영 정책</Link>
        <Link href="/settings/profile-badges">프로필 뱃지</Link>
      </nav>
    </main>
  );
}
