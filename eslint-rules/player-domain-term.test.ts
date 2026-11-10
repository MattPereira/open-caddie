import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const RULE = "local/player-domain-term";
const eslint = new ESLint({ cwd: process.cwd() });

async function violations(code: string, filePath = "lib/rounds/example.ts") {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.ruleId === RULE)
    .map((message) => message.message);
}

describe("player-domain-term lint rule (ADR 0006)", () => {
  it.each([
    ["a variable", "const userId = '1';"],
    ["a parameter", "export function f(userId: string) { return userId; }"],
    ["a function", "export function getRoundsForUser() {}"],
    ["a type", "export type StandingUser = { id: string };"],
    ["a generic", "export type Row<TUser> = { player: TUser };"],
    ["an object key", "export const x = { user: 1 };"],
    ["a type member", "export type X = { viewerUserId: string };"],
  ])("rejects a User-named %s in domain code", async (_, code) => {
    expect(await violations(code)).not.toHaveLength(0);
  });

  it("rejects a User-named JSX prop", async () => {
    expect(
      await violations("export const x = <Sidebar user={null} />;", "components/x.tsx"),
    ).not.toHaveLength(0);
  });

  it.each([
    ["the Auth.js users table", "import { users } from '@/db/schema'; export const t = users;"],
    ["session property access", "import { auth } from '@/auth'; export const id = async () => (await auth())?.user?.id;"],
    ["username", "export const usernameTaken = (username: string) => username;"],
    ["third-party icons", "import { UserAdd02Icon } from '@hugeicons/core-free-icons'; export const i = UserAdd02Icon;"],
    ["the LLM user prompt", "export function buildRoundScorecardUserPrompt() {}"],
    ["the HTTP user agent", "export const rule = { userAgent: '*' };"],
    ["string literals", "export const role = 'user'; export const path = 'users/abc';"],
  ])("allows %s in domain code", async (_, code) => {
    expect(await violations(code)).toEqual([]);
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
