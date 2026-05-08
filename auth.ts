import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Resend({
      from: "auth@login.ccgc.app",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.username = user.username ?? null;
        token.firstName = user.firstName ?? null;
        token.lastName = user.lastName ?? null;
        token.isAdmin = user.isAdmin ?? false;
      }
      if (trigger === "update" && session?.user) {
        if (session.user.username !== undefined)
          token.username = session.user.username;
        if (session.user.firstName !== undefined)
          token.firstName = session.user.firstName;
        if (session.user.lastName !== undefined)
          token.lastName = session.user.lastName;
        if (session.user.name !== undefined) token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string | null;
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
});
