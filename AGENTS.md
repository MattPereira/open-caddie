<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## User Interface

- use shadcn and tailwind to build ans style all UI components
- use react hook form for all forms
- prioritize mobile first designs but also support desktop views
- use hugeicons for icons
- shadcn `radix-nova` style registry is incomplete: `components/ui/form.tsx` was sourced from the `new-york` style URL and patched to use the unified `radix-ui` package; revisit and re-run `pnpm dlx shadcn@latest add @shadcn/form --overwrite` once the upstream registry is fixed
