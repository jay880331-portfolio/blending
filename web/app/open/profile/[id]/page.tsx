import { OpenProfileSmartLink } from "./OpenProfileSmartLink";

export default async function OpenProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OpenProfileSmartLink profileId={id} />;
}
