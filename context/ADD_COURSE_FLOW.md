# Add Course via Scorecard Image — Pickup Prompt

> Drop this file (or its contents) into a fresh Claude session to resume work.

## Ultimate goal

Let a user upload an image of a course's printed scorecard, and have an LLM
parse the structured data so they don't have to type it all by hand:

- Course name
- One or more tee sets, each with: name (e.g. "Blue"), color, rating, slope,
  and per-hole yardages
- Per-hole par and handicap (stroke index)

The same parsing infrastructure (blob upload, LLM call, edit/confirm UI) will
later be reused for a separate **"upload my round scorecard"** feature, where
the LLM parses handwritten stroke counts. We're starting with **course
creation** because printed text is much easier to parse accurately than
handwriting, which lets us de-risk the entire pipeline first.

## What was already decided

- **Start with course scorecards (printed), not round scorecards (handwritten).**
  Higher accuracy ceiling, lower-stakes mistakes, reusable infra.
- **LLM vision is the parsing approach** (not classical OCR). Concrete model
  TBD — likely Claude Haiku 4.5 or Gemini Flash for cost. A spike is needed to
  measure accuracy/cost on real scorecards.
- **Always show parsed output in an editable confirm screen before save.** Even
  at 95% accuracy, one bad number ruins a course's data. The parse just needs
  to be close.
- **One scorecard image per course**, stored in Vercel Blob, with the URL on
  `courses.scorecardImgUrl` (column already added this session). Per-tee images
  are overkill — physical cards show all tees on one card.
- **Audit trail**: keep the source image even after parsing so we can re-parse
  if the model improves or debug a bad parse.

## What we did this session (schema foundation)

Before building the upload/parse feature, we restructured the schema to
support multi-tee courses, because the old `courses` table baked rating/slope
into the course itself — which is wrong (rating/slope are per-tee).

**Schema changes** (`db/schema.ts`):

- New `course_tees` table: `(id, courseId, name, color, rating, slope, sortOrder)`
  with unique `(courseId, name)`. `sortOrder` controls display order per
  course (lowest first, typically longest tees first).
- New `tee_yardages` table: `(teeId, hole, yards)` with PK `(teeId, hole)`.
  Holds per-tee yardage data — currently empty for all existing courses.
- `tournaments.teeId` (`NOT NULL`, FK → `course_tees.id`) — tournaments
  played from a specific tee.
- `rounds.teeId` (`NOT NULL`, FK → `course_tees.id`) — a round is played from
  a specific tee. Stored explicitly even for tournament rounds (denormalized)
  so casual rounds and tournament rounds share the same code path, and so a
  player could theoretically play different tees than the tournament's
  default.
- `courses.rating` and `courses.slope` were **dropped**. Course-level
  rating/slope no longer makes sense once tees exist.
- `courses.scorecardImgUrl` (nullable text) added — the destination column for
  the scorecard image we'll upload to Blob.
- `roundSummaries` view was rewired to join `course_tees` via `rounds.teeId`,
  but the `courseRating` / `courseSlope` aliases were preserved so downstream
  query consumers and scoring code didn't need any changes.

**Code changes**:

- `db/queries/courses.ts` — added `getPrimaryTeeIdByCourseId(courseId)`
  helper. `getAllCourses` and `getCourseByHandle` still return flat
  `rating`/`slope` fields, but they now come from the course's primary tee
  (lowest `sortOrder`). Return shapes unchanged so all UI components keep
  working.
- `app/(app)/admin/actions.ts` — `createCourse` inserts a `"Default"` tee with
  the form's rating/slope; `updateCourse` updates the primary tee row instead
  of the course; `createTournament` / `updateTournament` auto-set `teeId`
  from the course's primary tee.
- `app/(app)/rounds/actions.ts` — `createRound` sets `teeId` from the
  tournament (for tournament rounds) or the course's primary tee (for casual
  rounds).
- `app/(app)/tournaments/actions.ts` — `addPlayersToTournament` propagates the
  tournament's `teeId` onto created round rows.
- `scripts/migrate-from-ccgc.ts` — legacy CCGC importer updated to create a
  `"Default"` tee per course.

## The "Unknown tee" temporary state

This is the most important thing for the next session to understand.

Every pre-existing course in production was backfilled with a single tee row
named **`"Unknown"`** (sortOrder `0`, no color, rating/slope copied from the
old `courses` columns, **zero `tee_yardages` rows**). All 56 existing
tournaments and 628 existing rounds were pointed at their course's Unknown
tee via `teeId`.

**Why this matters:**

- All historical handicap differentials still compute correctly because the
  Unknown tee carries the same rating/slope the old `courses` row had.
- The "primary tee per course" logic (`getPrimaryTeeIdByCourseId`) currently
  always returns the Unknown tee for legacy courses, which keeps every
  existing page rendering identically to before the migration. **No
  user-visible behavior changed.**
- We have **no yardage data** for any legacy course yet. Any future
  per-course-length analytics need to filter `WHERE yards IS NOT NULL` and
  treat the absent data as "not yet captured."

**The Unknown tee is filled in over time, not all at once.** Each time
someone uploads a real scorecard for a legacy course (via the feature we're
about to build), the parse will produce real tees (Blue/White/Red/etc.) and
the Unknown tee can either be deleted or repurposed. We haven't decided yet
which — see open questions below.

## Setup complete (skip in next session)

### Step 1 — Install + auth ✅

- `ai@^6` and `@ai-sdk/gateway@^3` installed via `pnpm add`.
- Project linked to Vercel (`vercel link` → `matt-pereiras-projects/open-caddie`).
- AI Gateway enabled in the Vercel dashboard.
- Auth via Vercel OIDC. `VERCEL_OIDC_TOKEN` is pulled into `.env.local` by
  `vercel env pull` and is valid ~24h locally. Re-pull when the SDK starts
  returning 401s. No `AI_GATEWAY_API_KEY` or provider-specific API keys
  needed — plain `"provider/model"` strings auto-route through the gateway.
- Env var hygiene decided: Development-tier secrets are stored
  **non-Sensitive** so `vercel env pull` can retrieve them cleanly.
  Production/Preview copies can stay Sensitive. `.gitignore` updated with
  `!.env.example` so an example file can be committed when we add one.

## Next steps — what to actually build

### Phase 1: Parsing spike (must do first)

Before any UI work, validate the parsing approach end to end.

1. Collect 5–10 real printed scorecards from courses you have on hand
   (varied layouts, lighting, angles).
2. Pick a vision LLM. Start with Claude Haiku 4.5 (cheap, fast, decent vision)
   or Gemini Flash. Use the Vercel AI Gateway via the AI SDK so we can swap
   providers behind one string ID without changing code.
3. Write a small Node script (`scripts/spike-parse-scorecard.ts`) that takes a
   local image path, hits the LLM with a structured-output prompt, and prints
   the JSON.
4. **Target JSON contract** the LLM should return:
   ```ts
   {
     courseName: string,
     tees: Array<{
       name: string,            // exactly as printed
       color?: "red" | "white" | "blue" | "gold" | "black" | "green" | "silver",
       rating: number,
       slope: number,
       yardages: number[]       // length 18
     }>,
     holes: Array<{
       hole: number,            // 1..18
       par: number,
       handicap: number         // 1..18, the stroke index
     }>
   }
   ```
5. Measure accuracy on the test set. Decide whether to require tightly-cropped
   scorecard photos (vs. allowing whole-card photos with extra background).
   Document failure modes — these inform UI affordances (e.g., "crop to just
   the scorecard table" guidance).

The spike's output answers: is this model good enough, or do we need to pay
for a stronger one?

### Phase 2: Upload + storage plumbing

Once the spike is satisfactory:

1. New page or modal in admin: image upload using the existing crop UI
   pattern (user/course image upload already uses cropping — reuse the
   component).
2. Upload to Vercel Blob, save URL temporarily (e.g. in form state or
   on a draft `courses` row).
3. Server action: read the blob URL, fetch the image, call the LLM with the
   prompt from the spike, return parsed JSON.

### Phase 3: Confirm/edit UI

1. Render the parsed JSON as a pre-populated form with:
   - Course name + handle
   - One section per tee, each with rating/slope/color inputs + a yardage
     grid (18 inputs)
   - The holes table (par + handicap per hole)
2. All fields editable; user reviews and corrects bad parses.
3. Submit creates the `courses`, `course_tees`, `tee_yardages`, and
   `course_holes` rows in a single transaction, plus persists
   `courses.scorecardImgUrl` to the uploaded blob URL.

### Phase 4: Wiring into the app

1. The existing admin "Create Course" form is the entry point — add an
   "Upload scorecard" button alongside the manual entry path.
2. The manual entry path stays available as a fallback. Update it to support
   multi-tee creation (it currently only handles one rating/slope pair — see
   `app/(app)/admin/_components/course-sheet.tsx` and
   `app/(app)/admin/schema.ts`).
3. Course detail page (`app/(app)/courses/[handle]/page.tsx`) should start
   displaying multiple tees once any course has more than one. Currently it
   shows the primary tee's rating/slope only.

### Phase 5 (later, separate feature): handwritten round scorecards

The whole pipeline above is the dress rehearsal. The eventual handwritten
round upload reuses the blob upload + LLM-call + confirm UI patterns, just
with a simpler JSON contract: `{ holes: number[] }`. Don't build this until
Phase 1–4 ship and the patterns are settled.

## Open questions to decide when picking back up

- **Where does the "Upload scorecard" entry point live?** Admin-only at first
  (since this is the same surface as create-course), or eventually open to
  any user?
- **How do we handle legacy "Unknown" tees once a real scorecard is uploaded
  for that course?** Options: (a) replace it entirely — risky for existing
  rounds/tournaments still pointing at it; (b) keep it forever, hidden from
  UI; (c) migrate existing rounds onto whichever new tee best matches
  recorded scores. Probably (b) for simplicity, but worth a decision.
- **Model choice + cost ceiling.** Decide after the spike. The AI Gateway lets
  us swap, but we should pick a default and a fallback.
- **Should we also store the raw LLM response** (e.g. `courses.scorecardParseRaw
  jsonb`) for debugging bad parses? Leaning no — add only if we hit a
  debugging wall.

## Related TODO outside this feature

The Neon dev-vs-prod branch split is not actually wired up yet — every local
command currently hits prod. See the "Environments" callout in the project
README. Not a blocker for the scorecard feature, but worth fixing before any
more schema migrations land.

## File pointers (for the next session)

- `db/schema.ts` — current schema (tees-based)
- `db/queries/courses.ts` — `getPrimaryTeeIdByCourseId` helper
- `app/(app)/admin/actions.ts` — `createCourse` / `updateCourse` (rewrite for
  the new multi-tee form)
- `app/(app)/admin/_components/course-sheet.tsx` — manual course entry UI
- `app/(app)/admin/schema.ts` — `ratingString` validator + `CourseFormSchema`
- `app/(app)/courses/[handle]/page.tsx` — course detail page
- `lib/blob.ts` — existing Vercel Blob helpers (`safeDeleteBlob`)

## Starter prompt for the next session

> I want to pick up the "upload scorecard image → LLM parse → create course"
> feature. Read `context/ADD_COURSE_FLOW.md` for the full plan, the schema
> changes we already made, the "Unknown tee" legacy state, and the
> "Setup complete" section — the AI SDK + Vercel AI Gateway packages are
> already installed and OIDC auth is wired up, so skip env/install setup.
>
> Let's jump straight to **Phase 1: the parsing spike** — propose a model
> choice via the Vercel AI Gateway (Claude Haiku 4.5 unless you have a strong
> reason otherwise), draft the structured-output Zod schema and prompt, and
> write `scripts/spike-parse-scorecard.ts` as a CLI that takes a local image
> path and prints parsed JSON + token usage. I'll provide local test images.
