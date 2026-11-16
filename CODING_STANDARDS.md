# Coding standards

## Let the code explain itself

Name and extract until a comment is unnecessary. A comment earns its place
only for a _why_ the code cannot express: a constraint, a decision, a link to
the ADR behind it. A comment that restates _what_ the code does goes stale the
first time the code changes.

## Actions are thin

A route's `actions.ts` reads the session, parses input with zod, does
request-only work (headers, sign-in email), calls one module write, then
`redirect`s.
