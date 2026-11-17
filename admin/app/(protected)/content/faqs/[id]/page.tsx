import { FaqFormScreen } from "../../../../../src/ui/content/FaqFormScreen";

export default async function FaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FaqFormScreen id={id} />;
}
