import { beforeAll, describe, expect, it } from "vitest";

import { lintFixtures, type Diagnostic } from "./lint-fixtures";

const RULE = "local/player-domain-term";

const REJECTED: [string, string, string[]][] = [
  ["a variable", "export const userId = '1';", ["userId"]],
  [
    "a parameter",
    "export function f(userId: string) { return userId; }",
    ["userId", "userId"],
  ],
  ["a function", "export function getRoundsForUser() {}", ["getRoundsForUser"]],
  ["a type", "export type StandingUser = { id: string };", ["StandingUser"]],
  [
    "a generic",
    "export type Row<TUser> = { player: TUser };",
    ["TUser", "TUser"],
  ],
  ["an object key", "export const x = { user: 1 };", ["user"]],
  [
    "a type member",
    "export type X = { viewerUserId: string };",
    ["viewerUserId"],
  ],
  [
    "local `users` binding",
    "const users = [1]; export const n = users.length;",
    ["users", "users"],
  ],
  [
    "`users` imported from elsewhere",
    "import { users } from './fixtures'; export const t = users;",
    ["users", "users"],
  ],
  [
    "locally declared User*Icon",
    "export const UserFooIcon = () => null;",
    ["UserFooIcon"],
  ],
  [
    "name merely containing UserPrompt",
    "export const userPromptUserId = '1';",
    ["userPromptUserId"],
  ],
];

const ALLOWED: [string, string][] = [
  [
    "the Auth.js users table",
    "import { users } from '@/db/schema'; export const t = users;",
  ],
  [
    "a qualified type name",
    "import type * as NextAuth from 'next-auth'; export type T = NextAuth.User;",
  ],
  [
    "session property access",
    "import { auth } from '@/auth'; export const id = async () => (await auth())?.user?.id;",
  ],
  ["username", "export const usernameTaken = (username: string) => username;"],
  [
    "third-party icons",
    "import { UserAdd02Icon } from '@hugeicons/core-free-icons'; export const i = UserAdd02Icon;",
  ],
  ["the LLM user prompt", "export function buildRoundScorecardUserPrompt() {}"],
  ["the HTTP user agent", "export const rule = { userAgent: '*' };"],
  [
    "string literals",
    "export const role = 'user'; export const path = 'users/abc';",
  ],
];

const SIGN_IN_FILES = [
  "src/auth.ts",
  "src/auth.types.d.ts",
  "src/lib/auth/sign-in-link.ts",
  "src/app/(app)/login/actions.ts",
  "src/app/api/auth/[...nextauth]/route.ts",
];

const JSX_FILE = "src/components/x.tsx";
const SCHEMA_FILE = "src/db/schema.ts";
const domainFile = (kind: string, i: number) =>
  `src/lib/rounds/${kind}-${i}.ts`;

const FIXTURES: Record<string, string> = {
  ...Object.fromEntries(
    REJECTED.map(([, code], i) => [domainFile("rejected", i), code]),
  ),
  ...Object.fromEntries(
    ALLOWED.map(([, code], i) => [domainFile("allowed", i), code]),
  ),
  ...Object.fromEntries(
    SIGN_IN_FILES.map((path) => [path, "export const userId = '1';"]),
  ),
  [JSX_FILE]: "export const x = <Sidebar user={null} />;",
  [SCHEMA_FILE]: "export const users = {}; export const ref = () => users;",
};

let results: Map<string, Diagnostic[]>;
beforeAll(async () => {
  results = await lintFixtures(FIXTURES);
}, 30_000);

function violations(path: string) {
  return results
    .get(path)!
    .filter((d) => d.rule === RULE)
    .map((d) => d.message.match(/^'(\w+)'/)?.[1] ?? d.message);
}

describe("player-domain-term lint rule (ADR 0007)", () => {
  it.each(REJECTED.map((c, i) => [...c, i] as const))(
    "rejects a User-named %s in domain code",
    (_name, _code, names, i) => {
      expect(violations(domainFile("rejected", i))).toEqual(names);
    },
  );

  it("rejects a User-named JSX prop", () => {
    expect(violations(JSX_FILE)).toEqual(["user"]);
  });

  it.each(ALLOWED.map((c, i) => [...c, i] as const))(
    "allows %s in domain code",
    (_name, _code, i) => {
      expect(violations(domainFile("allowed", i))).toEqual([]);
    },
  );

  it("allows the Auth.js users table where db/schema.ts declares it", () => {
    expect(violations(SCHEMA_FILE)).toEqual([]);
  });

  it.each(SIGN_IN_FILES)("allows User naming in sign-in code: %s", (path) => {
    expect(violations(path)).toEqual([]);
  });
});
