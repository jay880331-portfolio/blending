import { ProfileBadgeFormScreen } from "../../../../../../src/ui/settings/ProfileBadgeFormScreen";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProfileBadgeFormScreen id={(await params).id} />;
}
