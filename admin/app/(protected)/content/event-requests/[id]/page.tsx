import { EventRequestDetailScreen } from "../../../../../src/ui/content/EventRequestDetailScreen";

export default async function EventRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EventRequestDetailScreen id={(await params).id} />;
}
