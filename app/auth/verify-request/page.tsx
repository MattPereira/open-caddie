import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VerifyRequestPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyRequestPage({
  searchParams,
}: VerifyRequestPageProps) {
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            A magic sign in link has been sent to{" "}
            {email ? <span className="font-medium">{email}</span> : "your email address"}.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
