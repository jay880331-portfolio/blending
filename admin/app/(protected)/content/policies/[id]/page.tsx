import { PolicyFormScreen } from "../../../../../src/ui/content/PolicyFormScreen";

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PolicyFormScreen id={id} />;
}
