import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginPageForm } from "./_components/login-page-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; email?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  const { error, email } = await searchParams;

  return (
    <LoginPageForm hasAuthError={error !== undefined} rejectedEmail={email} />
  );
}
