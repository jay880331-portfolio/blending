import { CommunityApp } from "@/ui/community/CommunityApp";
import { DailyNoteApp } from "@/ui/community/DailyNoteApp";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

type CommunityPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function CommunityPage({ params }: CommunityPageProps) {
  await requireAuthenticatedPage();

  const { view = ["calendar"] } = await params;
  if (view[0] === "daily-note") return <DailyNoteApp view={view} />;
  return <CommunityApp view={view} />;
}
