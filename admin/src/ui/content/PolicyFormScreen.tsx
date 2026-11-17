import { GuideContentFormScreen } from "./GuideContentFormScreen";

export function PolicyFormScreen({ id }: { id?: string }) {
  return <GuideContentFormScreen kind="policy" id={id} />;
}
