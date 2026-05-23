# Open Caddie

A golf scorekeeping app for casual rounds, competitive formats, and club organizations

- Track multiplayer contests including match play, skins games, and tournaments
- Organize clubs with player groups, customizable point scoring, and season-long standings
- Use AI-powered workflows to add course data from scorecard images and upload round scores from photos

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
