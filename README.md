<img width="909" height="301" alt="image" src="https://github.com/user-attachments/assets/7849fec4-f2cc-44e6-964b-372c134c9007" />

Track match play, skins games, and tournaments. Organize clubs with customizable point scoring and season-long standings. Automated AI workflows to add course data from scorecard images and upload round scores from photos

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
