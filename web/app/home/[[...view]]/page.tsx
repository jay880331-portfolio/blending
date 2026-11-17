import { HomeApp } from "@/ui/home/HomeApp";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

type HomePageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function HomePage({ params }: HomePageProps) {
  await requireAuthenticatedPage();

  const { view = [] } = await params;
  return <HomeApp area="home" view={view} />;
}
