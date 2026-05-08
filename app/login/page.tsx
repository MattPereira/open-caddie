import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginPageForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return <LoginPageForm />;
}
