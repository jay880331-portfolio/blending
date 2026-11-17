import { Suspense } from "react";
import { EventRequestListScreen } from "../../../../src/ui/content/EventRequestListScreen";

export default function EventRequestsPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <EventRequestListScreen />
    </Suspense>
  );
}
