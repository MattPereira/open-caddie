import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const RULE = "local/player-domain-term";
const eslint = new ESLint({ cwd: process.cwd() });

async function violations(code: string, filePath = "lib/rounds/example.ts") {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => message.message.match(/^'(\w+)'/)?.[1] ?? message.message);
}

describe("player-domain-term lint rule (ADR 0007)", () => {
  it.each([
    ["a variable", "export const userId = '1';", ["userId"]],
    ["a parameter", "export function f(userId: string) { return userId; }", ["userId", "userId"]],
    ["a function", "export function getRoundsForUser() {}", ["getRoundsForUser"]],
    ["a type", "export type StandingUser = { id: string };", ["StandingUser"]],
    ["a generic", "export type Row<TUser> = { player: TUser };", ["TUser", "TUser"]],
    ["an object key", "export const x = { user: 1 };", ["user"]],
    ["a type member", "export type X = { viewerUserId: string };", ["viewerUserId"]],
    ["local `users` binding", "const users = [1]; export const n = users.length;", ["users", "users"]],
    ["`users` imported from elsewhere", "import { users } from './fixtures'; export const t = users;", ["users", "users"]],
    ["locally declared User*Icon", "export const UserFooIcon = () => null;", ["UserFooIcon"]],
    ["name merely containing UserPrompt", "export const userPromptUserId = '1';", ["userPromptUserId"]],
  ])("rejects a User-named %s in domain code", async (_, code, names) => {
    expect(await violations(code)).toEqual(names);
  });

  it("rejects a User-named JSX prop", async () => {
    expect(
      await violations("export const x = <Sidebar user={null} />;", "components/x.tsx"),
    ).toEqual(["user"]);
  });

  it.each([
    ["the Auth.js users table", "import { users } from '@/db/schema'; export const t = users;"],
    ["a qualified type name", "import type * as NextAuth from 'next-auth'; export type T = NextAuth.User;"],
    ["session property access", "import { auth } from '@/auth'; export const id = async () => (await auth())?.user?.id;"],
    ["username", "export const usernameTaken = (username: string) => username;"],
    ["third-party icons", "import { UserAdd02Icon } from '@hugeicons/core-free-icons'; export const i = UserAdd02Icon;"],
    ["the LLM user prompt", "export function buildRoundScorecardUserPrompt() {}"],
    ["the HTTP user agent", "export const rule = { userAgent: '*' };"],
    ["string literals", "export const role = 'user'; export const path = 'users/abc';"],
  ])("allows %s in domain code", async (_, code) => {
    expect(await violations(code)).toEqual([]);
  });

  it("allows the Auth.js users table where db/schema.ts declares it", async () => {
    expect(
      await violations("export const users = {}; export const ref = () => users;", "db/schema.ts"),
    ).toEqual([]);
  });

  it.each([
    "auth.ts",
    "auth.types.d.ts",
    "lib/auth/sign-in-link.ts",
    "app/(app)/login/actions.ts",
    "app/api/auth/[...nextauth]/route.ts",
  ])("allows User naming in sign-in code: %s", async (filePath) => {
    expect(await violations("export const userId = '1';", filePath)).toEqual([]);
  });
});
