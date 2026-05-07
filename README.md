# Open Caddie

A golf score keeping app that facilitates club tournaments with handicaps, points, leaderboards, and AI augmented workflows.

## Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js (App Router, Server Actions)                         |
| Language            | TypeScript                                                   |
| Database            | Neon (serverless Postgres, scales to zero, branching per PR) |
| ORM                 | Drizzle + drizzle-kit                                        |
| Auth                | Auth.js v5 — Google OAuth + email magic links                |
| Email (magic links) | Resend                                                       |
| AI SDK              | Vercel AI SDK                                                |
| LLM (vision + chat) | Claude Sonnet 4.6 or GPT-4o                                  |
| Image storage       | Vercel Blob                                                  |
| Hosting             | Vercel                                                       |
| Styling             | Tailwind CSS + shadcn/ui                                     |
| Validation          | Zod (schemas for Server Actions + AI structured output)      |
