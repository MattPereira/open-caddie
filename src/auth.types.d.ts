import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      isPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isPlatformAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    isPlatformAdmin?: boolean;
  }
}
