import { notFound } from "next/navigation";
import { getBrewGuideById } from "@/infrastructure/server/brewGuideRepository";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { BrewGuideCardApp } from "@/ui/brewGuide/BrewGuideCardApp";

export const dynamic = "force-dynamic";

export default async function BrewGuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedPage();
  const { id } = await params;
  const guide = await getBrewGuideById(id);
  if (!guide) {
    notFound();
  }
  return <BrewGuideCardApp guide={guide} />;
}
