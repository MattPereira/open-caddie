# Open Caddie

A modern golf application for match play and tournament coordination

- Organize clubs with tournament events and season long standings
- Set up match play for two to four players with customizable rules
- Skins games with customizable rules
- Dictate scores verbally during a round for yourself and friends
- Upload scorecard image to automatically add a new course
- Upload handwritten scores image to automatically populate a round

### Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js (App Router, Server Actions)                         |
| Database            | Neon (serverless Postgres)                                   |
| ORM                 | Drizzle + drizzle-kit                                        |
| Auth                | Auth.js v5 — Google OAuth + email magic links                |
| Image storage       | Vercel Blob                                                  |
| Hosting             | Vercel                                                       |
| AI Workflows        | Vercel AI SDK + AI Gateway                                   |
| Styling             | Tailwind CSS + shadcn/ui                                     |
