import { LoginApp } from "@/ui/auth/LoginApp";

type LoginPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { view = [] } = await params;
  return <LoginApp view={view} />;
}
