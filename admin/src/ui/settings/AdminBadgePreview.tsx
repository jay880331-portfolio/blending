import styles from "./profileBadges.module.css";

export function AdminBadgePill({ name }: { name: string }) {
  if (!name.trim()) return null;
  return <span className={styles.pill}>{name.trim()}</span>;
}

export function AdminBadgeAvatarPreview({ name }: { name: string }) {
  const label = name.trim() || "뱃지 이름";
  return (
    <div className={styles.avatarPreview}>
      <span className={styles.avatar} aria-hidden />
      <span className={styles.pill}>{label}</span>
    </div>
  );
}
