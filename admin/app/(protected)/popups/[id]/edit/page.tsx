import { PopupFormScreen } from "../../../../../src/ui/popups/PopupFormScreen";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PopupFormScreen id={(await params).id} />;
}
