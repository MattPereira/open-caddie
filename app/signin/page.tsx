import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return <SignInForm />;
}
