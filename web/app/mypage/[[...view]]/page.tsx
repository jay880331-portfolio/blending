import { HomeApp } from "@/ui/home/HomeApp";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

type MyPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function MyPage({ params }: MyPageProps) {
  await requireAuthenticatedPage();

  const { view = [] } = await params;
  return <HomeApp area="mypage" view={view} />;
}
