---
status: accepted
date: 2026-09-30
---

# Anonymous traffic must not wake Neon

Postgres runs on Neon's free plan: a fixed 0.25 CU compute that scales to zero after 5 idle minutes, billed against a monthly compute-hour quota. Any request that reads Postgres while the compute is suspended wakes it for at least 5 minutes, so the cost of a request is dominated by _whether_ it touches the database, not by how heavy its query is. In late September 2026 the compute woke ~62 times a day, evenly around the clock; each overnight wake lined up with a single anonymous crawler hit on a `force-dynamic` detail page such as `/rounds/<id>`. Wakes under 10 minutes — one request each — were ~30% of compute hours.

We therefore treat keeping anonymous traffic off Postgres as a standing constraint:

- **`app/robots.ts` disallows everything except the home page and OG images.** Detail pages are not crawlable. OG image routes stay allowed so link previews from bots that honour robots.txt keep working — those only fire when someone shares a link.
- **Data shown to anonymous visitors is served from a tag-invalidated cache, never a time-based one.** `getHomeEvents` (`lib/home/queries.ts`) is the pattern: `unstable_cache` with `revalidate: false`, invalidated by the writes that change it. A `revalidate` interval would let a crawler trigger a refetch and wake the compute.
- **The Vercel Firewall blocks known AI bots** (a dashboard setting, not code), covering scrapers that ignore robots.txt.

## Considered options

- **Leave pages crawlable and accept the compute cost** was rejected: on the free plan the quota is the hard limit, and search indexing of individual rounds and players has no value for a private golf group.
- **Time-based revalidation** (`revalidate: N`) was rejected because each expiry becomes a wake whenever the next request arrives, which for crawlers is around the clock.
- **Require sign-in for all detail pages** would guarantee no anonymous reads but was not chosen; shared links to rounds, matches, and tournaments are meant to open without an account.

## Consequences

New public pages, or new anonymous reads on existing ones, must either use a tag-invalidated cache or accept that every anonymous hit can wake Neon. Detail pages still read Postgres directly for anonymous visitors and rely on robots.txt and the firewall; caching their anonymous path the way the home page is cached is the remaining follow-up. Revisit this ADR if the project moves to a paid Neon plan or wants search indexing.
