import { Suspense } from "react";
import { GuideContentListScreen } from "../../../../src/ui/content/GuideContentListScreen";

export default function NoticesPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <GuideContentListScreen kind="notice" />
    </Suspense>
  );
}
