import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CreditCard, Store } from "lucide-react";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { BottomNav } from "@/ui/shared/BottomNav";
import { ProfileSwipeCard } from "@/ui/profile/ProfileSwipeCard";
import { getPublicProfileData } from "./data";
import { profilePageNavigation } from "@/ui/shared/profileNavigation";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  await requireAuthenticatedPage();

  const { id } = await params;
  const { returnTo } = await searchParams;
  const navigation = profilePageNavigation(
    typeof returnTo === "string" ? returnTo : undefined,
  );
  const data = await getPublicProfileData(id);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
      <PublicProfileHeader backHref={navigation.backHref} />
      <section className="space-y-3 px-4 py-4">
        <ProfileSwipeCard
          profile={data.profile}
          careers={data.careers}
          portfolios={data.portfolios}
          blockedRedirectHref="/map"
          variant="home"
        />
        {data.profile.role === "barista" ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--accent)]">
                <Store size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--fg-strong)] truncate">
                  바리스타 쇼룸 & 현장 혜택
                </p>
                <p className="text-[12px] text-[var(--fg-muted)] truncate">
                  대표 메뉴, 디지털 쿠폰 및 타임세일 소식
                </p>
              </div>
            </div>
            <Link
              href={`/showroom/${data.ownerId}`}
              className="shrink-0 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-[12px] font-bold text-[var(--surface)] hover:bg-[var(--accent-hover)] transition active:scale-95"
            >
              쇼룸 방문
            </Link>
          </div>
        ) : null}
        <CertificateSection certificateName={data.profile.certificateName} />
      </section>
      <BottomNav active={navigation.active} />
    </main>
  );
}

function PublicProfileHeader({
  backHref,
  title,
}: {
  backHref: string;
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[calc(76px_+_env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 pt-[env(safe-area-inset-top)]">
      <Link
        href={backHref}
        aria-label="이전 화면으로 돌아가기"
        className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
      >
        <ChevronLeft size={26} strokeWidth={2.2} />
      </Link>
      <h1 className="logo-wordmark text-[24px] font-bold text-[var(--fg-strong)]">
        {title ?? "BLENDING"}
      </h1>
      <span aria-hidden className="h-11 w-11" />
    </header>
  );
}

function CertificateSection({ certificateName }: { certificateName: string }) {
  if (!certificateName.trim()) return null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]">
          <CreditCard size={15} aria-hidden />
        </span>
        <h2 className="text-[16px] font-bold text-[var(--fg-strong)]">
          자격증
        </h2>
        <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-0.5 text-[12px] font-medium text-[var(--fg-muted)]">
          1건
        </span>
      </div>
      <article className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
        <h3 className="text-[16px] font-bold text-[var(--fg-strong)]">
          {certificateName}
        </h3>
      </article>
    </section>
  );
}
