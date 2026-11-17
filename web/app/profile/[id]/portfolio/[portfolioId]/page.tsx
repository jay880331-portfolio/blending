import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { BottomNav } from "@/ui/shared/BottomNav";
import { DetailAuthorMeta } from "@/ui/shared/DetailAuthorMeta";
import { getPublicPortfolioData } from "../../data";
import { buildProfileHref } from "@/ui/shared/profileNavigation";

type PortfolioPageProps = {
  params: Promise<{ id: string; portfolioId: string }>;
};

export default async function PublicPortfolioPage({
  params,
}: PortfolioPageProps) {
  await requireAuthenticatedPage();

  const { id, portfolioId } = await params;
  const data = await getPublicPortfolioData(id, portfolioId);
  if (!data) notFound();

  const images = data.portfolio.imageUrls.slice(0, 10);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--bg)] pb-28 text-[var(--fg)]">
      <header className="sticky top-0 z-20 flex h-[calc(76px_+_env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 pt-[env(safe-area-inset-top)]">
        <Link
          href={`/profile/${data.ownerId}`}
          aria-label="프로필로 돌아가기"
          className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
        >
          <ChevronLeft size={26} strokeWidth={2.2} />
        </Link>
        <h1 className="text-[18px] font-bold text-[var(--fg-strong)]">
          포트폴리오 상세
        </h1>
        <span aria-hidden className="h-11 w-11" />
      </header>

      <section className="px-6 py-6">
        <PortfolioImage src={images[0]} alt={data.portfolio.title} />
        {images.length > 1 ? (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {images.slice(1).map((image, index) => (
              <PortfolioThumb
                key={`${image}-${index}`}
                src={image}
                alt={`${data.portfolio.title} ${index + 2}번째 이미지`}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-10">
          <DetailAuthorMeta
            name={data.profile.handle}
            date={data.portfolio.createdAt}
            avatarUrl={data.profile.avatarUrl}
            profileHref={buildProfileHref(
              data.ownerId,
              `/profile/${data.ownerId}/portfolio/${portfolioId}`,
            )}
          />
          <h2 className="mt-2 text-[24px] font-bold text-[var(--fg-strong)]">
            {data.portfolio.title}
          </h2>
        </div>

        <p className="mt-10 whitespace-pre-line rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-[16px] leading-8 text-[var(--fg)]">
          {data.portfolio.summary.slice(0, 500)}
        </p>
      </section>

      <BottomNav active="map" />
    </main>
  );
}

function PortfolioImage({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
      {src ? (
        <span
          className="block h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${src})` }}
          role="img"
          aria-label={alt}
        />
      ) : (
        <ImageIcon size={34} strokeWidth={1.8} />
      )}
    </div>
  );
}

function PortfolioThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
      <span
        className="block h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
        role="img"
        aria-label={alt}
      />
    </span>
  );
}
