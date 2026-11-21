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

## Style with the theme you have

Color comes from the shadcn tokens in `src/app/globals.css`, lightened with a
Tailwind opacity modifier when needed: `bg-primary/10`, `bg-muted`,
`text-muted-foreground`. Each token is already tuned per theme, so one class
reads right in light and dark. A new token, an arbitrary color
(`bg-[oklch(…)]`) or a `dark:` override is a decision for a person: leave it
as a finding that names the closest built-in class and why it fell short.
