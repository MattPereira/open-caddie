# Coding standards

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.

## Let the code explain itself

Name and extract until a comment is unnecessary. A comment earns its place
only for a _why_ the code cannot express: a constraint, a decision, a link to
the ADR behind it. A comment that restates _what_ the code does goes stale the
first time the code changes.

## Arrange tests through the module under test

Test setup calls the module's own functions. When the function you need does
not exist, add it to the module rather than inserting rows directly, so a
change to how the module stores its data leaves its tests alone. Data another
module owns is set up through that module's entry points, and shared fixtures
in `src/test/fixtures/` follow the same rule.

## Import a module only through its entry points

A module in `src/modules/` exposes its root files and hides everything in
its subfolders. Import `@/modules/<name>` (runs anywhere) or
`@/modules/<name>/server` (server only), never `@/modules/<name>/lib/...`, and
have the module's own tests do the same.

## A route does not query data a module owns

Once a module owns a feature's data, the route asks the module for it and
does not import `@/db` or `drizzle-orm` itself, not even for a type. The module
re-exports any type its callers need.

## Actions are thin; modules own writes

A route's `actions.ts` is the entry point for a write: `"use server"`, the
session, zod parsing, request-only work (headers, sign-in email), a call into
the module, then `redirect`. The module write takes the acting Player's id
first, owns authorization and invalidation, and returns
`{ ok: true } | { ok: false; error }`. Tests pass the Player id in instead of
mocking auth.
