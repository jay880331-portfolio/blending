import { redirect } from "next/navigation";
import { PartnerApp } from "@/ui/partner/PartnerApp";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

type PartnerPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function PartnerPage({ params }: PartnerPageProps) {
  await requireAuthenticatedPage();

  const { view = ["promotions"] } = await params;
  if (view.length <= 1) redirect("/community/daily-note");
  return <PartnerApp view={view} />;
}
