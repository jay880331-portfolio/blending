import { GuideContentFormScreen } from "./GuideContentFormScreen";

export function NoticeFormScreen({ id }: { id?: string }) {
  return <GuideContentFormScreen kind="notice" id={id} />;
}
