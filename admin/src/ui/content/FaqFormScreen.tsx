import { GuideContentFormScreen } from "./GuideContentFormScreen";

export function FaqFormScreen({ id }: { id?: string }) {
  return <GuideContentFormScreen kind="faq" id={id} />;
}
