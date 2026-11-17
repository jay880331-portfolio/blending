import { HomeApp } from "@/ui/home/HomeApp";

type SignupPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function SignupPage({ params }: SignupPageProps) {
  const { view = ["type"] } = await params;
  return <HomeApp area="signup" view={view} />;
}
