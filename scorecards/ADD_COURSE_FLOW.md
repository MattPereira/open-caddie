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
- **LLM vision is the parsing approach** (not classical OCR).
- **Model choice resolved by the spike**: `google/gemini-3.1-flash-lite` via
  the Vercel AI Gateway. 99.61% field accuracy on the 5-card test set at
  ~$0.0026/parse (≈ $2.59 per 1,000 uploads). Cheaper than Claude Haiku 4.5
  and more accurate. Gateway lets us swap providers later behind one string
  ID without changing code.
- **Always show parsed output in an editable confirm screen before save.**
  Even at ~99% accuracy, one bad number ruins a course's data. The parse
  just needs to be close.
- **One scorecard image per course**, stored in Vercel Blob, with the URL on
  `courses.scorecardImgUrl` (column already added). Per-tee images are
  overkill — physical cards show all tees on one card.
- **User crops before upload.** The spike validated parsing on hand-cropped
  scorecards (table only, no marketing/maps). Production must enforce this
  — it's the cheapest accuracy lever.
- **Course name is NOT parsed.** User picks the course before uploading the
  scorecard, so the parser only emits tee data and per-hole par/handicap.
- **Men's rating/slope only for v1.** When cards show both M and W rating
  rows, the parser uses the men's values. Women's data is not captured;
  revisit later if/when we support gendered handicaps.
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

### Phase 1: Parsing spike ✅ DONE

Outcome: `google/gemini-3.1-flash-lite` at 99.61% field accuracy, ~$0.0026 per
parse, ~5 seconds latency. See "Phase 1 results" section below for details.

What lives in the repo now:

- `scripts/spike-parse-scorecard.ts` — CLI that takes an image path or a
  directory of images, calls the model via the AI Gateway with a Zod-schema
  structured-output prompt, runs deterministic sum-checks on the result, and
  saves one record per image to `scorecards/runs/<model-slug>/`. Run via
  `pnpm spike:scorecard ./scorecards/images [--model <id>]`.
- `scripts/eval-scorecard-runs.ts` — compares every model's most recent run
  per image against the verified truth in `scorecards/expected/`, prints
  per-card and per-model field accuracy with a per-field diff. Run via
  `pnpm tsx scripts/eval-scorecard-runs.ts`.
- `scorecards/images/` — 5 source scorecard photos (cropped to table only).
- `scorecards/expected/` — 5 hand-verified ground-truth JSON files. Built
  with Gemini Pro for drafting + human eyes for verification.
- `scorecards/runs/` — committed model run records (Haiku and Gemini Flash-Lite
  so far). Each record stores `parsed`, `usage`, `estimatedCostUsd`,
  `sumChecks`, and a `corrections: null` slot for hand-fixed labels.

**Current JSON contract** the model emits (see `ScorecardSchema` in
`scripts/spike-parse-scorecard.ts`):

```ts
{
  tees: Array<{
    name: string,            // exact label, e.g. "Blue"
    color?: "red" | "white" | "blue" | "gold" | "black" | "green" | "silver",
    rating: number,          // men's USGA rating
    slope: number,           // men's USGA slope
    yardages: number[],      // length 18, holes 1-18 in order
    printedOutYards: number, // OUT total exactly as printed
    printedInYards: number,
    printedTotalYards: number,
  }>,
  holes: Array<{
    hole: number,            // 1..18
    par: number,
    handicap: number,        // 1..18, unique (men's stroke index row)
  }>,
  printedOutPar: number,
  printedInPar: number,
  printedTotalPar: number,
}
```

The `printed*` totals exist so we can run deterministic OUT/IN/TOT sum-checks
against the per-hole values and surface inconsistencies in the confirm UI.

### Phase 2: Upload + storage plumbing (NEXT)

1. **Lift the parser out of the spike script into a shared module.** Create
   `lib/scorecard-parser.ts` and move the Zod `ScorecardSchema`, the
   `SYSTEM_PROMPT` / `USER_PROMPT` constants, the `verifySums` helper, and a
   `parseScorecardImage(buffer, mediaType, model?)` function. Have the spike
   script import from there so the parser stays single-sourced. The eval
   script can keep its own narrow types.
2. **Pick the entry surface.** Likely a new tab inside the existing admin
   "Create Course" sheet (`app/(app)/admin/_components/course-sheet.tsx`):
   one tab for manual entry (existing), one for "Upload scorecard."
3. **Image picker + crop.** Reuse the existing crop component used for
   user/course image upload. Force a crop step — the user MUST crop to just
   the scorecard table. Add inline guidance.
4. **Blob upload.** Use existing `lib/blob.ts` helpers. Upload the cropped
   image and capture the returned URL; hold it in form state until the
   course is saved.
5. **Server action: `parseScorecardFromUrl(blobUrl)`** in
   `app/(app)/admin/actions.ts`. Fetches the blob bytes, calls
   `parseScorecardImage`, returns the parsed JSON + sum-check report. Defer
   creating any DB rows here — that's Phase 3.
6. **v0 UI**: just show the parsed JSON (or pretty-printed table) in the
   sheet so we can verify end-to-end works in the browser before building
   the editable form. The editable confirm form is Phase 3.

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

## Phase 1 results (for future context)

Spike test set: 5 hand-cropped scorecards (Blue Rock East, Blue Rock West,
Chardonnay, Franklin Canyon, Wild Horse) covering 2–7 tees each, multiple
layouts including ones with vertical "INITIAL" divider columns and stacked
multi-position yardages.

Results on Gemini 3.1 Flash-Lite with the production prompt (in
`scripts/spike-parse-scorecard.ts`):

- 4/5 sum-clean parses
- 99.61% field-level accuracy vs hand-verified truth (768/771 cells correct)
- 3 misses total: one 2-yard misread on Blue Rock East's Blue IN total
  (cascaded to TOT), and one omitted `color` label on Franklin Canyon's Back
  tee (model declined to guess — conservative, not wrong).
- Cost: ~$0.0026/parse, ~5s latency.

Claude Haiku 4.5 on an earlier prompt hit 91% with structural errors
(column shifts, row carryover); the new prompt fixes those failure modes
but Gemini Flash-Lite is still both cheaper and more accurate, so it's the
default.

## Open questions to decide when picking back up

- **Where does the "Upload scorecard" entry point live?** Admin-only at
  first (same surface as create-course). Eventually opening to any user is
  an option but not Phase 2 scope.
- **How do we handle legacy "Unknown" tees once a real scorecard is uploaded
  for that course?** Options: (a) replace it entirely — risky for existing
  rounds/tournaments still pointing at it; (b) keep it forever, hidden from
  UI; (c) migrate existing rounds onto whichever new tee best matches
  recorded scores. Probably (b) for simplicity, but worth a decision before
  the confirm UI submits.
- **Should we also store the raw LLM response** (e.g.
  `courses.scorecardParseRaw jsonb`) for debugging bad parses? Leaning no —
  the source image is already kept, and we can re-parse anytime.
- **Model fallback policy.** Default is Gemini 3.1 Flash-Lite. If a parse
  fails (gateway error, schema violation, sum-checks all fail) should we
  auto-retry with a stronger model like Claude Sonnet 4.6, or just surface
  the error and let the user re-upload? Lean toward the latter for v1.

## Related TODO outside this feature

The Neon dev-vs-prod branch split is not actually wired up yet — every local
command currently hits prod. See the "Environments" callout in the project
README. Not a blocker for the scorecard feature, but worth fixing before any
more schema migrations land.

## File pointers (for the next session)

Parsing pipeline (already built — DO NOT rewrite, lift into `lib/`):
- `scripts/spike-parse-scorecard.ts` — Zod schema, prompt, sum-checks, CLI
- `scripts/eval-scorecard-runs.ts` — accuracy eval against `scorecards/expected/`
- `scorecards/images/` — test images
- `scorecards/expected/` — verified truth
- `scorecards/runs/` — committed model runs

Schema + DB (already built — see "Schema foundation" section above):
- `db/schema.ts` — current schema (tees-based, `courses.scorecardImgUrl` exists)
- `db/queries/courses.ts` — `getPrimaryTeeIdByCourseId` helper

App surfaces to edit in Phase 2:
- `app/(app)/admin/actions.ts` — add `parseScorecardFromUrl` server action;
  `createCourse` / `updateCourse` will later need a multi-tee rewrite
- `app/(app)/admin/_components/course-sheet.tsx` — add "Upload scorecard" tab
- `app/(app)/admin/schema.ts` — `ratingString` validator + `CourseFormSchema`
- `app/(app)/courses/[handle]/page.tsx` — course detail page (Phase 4)
- `lib/blob.ts` — existing Vercel Blob helpers (`safeDeleteBlob`)

To create in Phase 2:
- `lib/scorecard-parser.ts` — extract schema/prompt/parser from the spike
  script so the server action and the spike share one source of truth

## Starter prompt for the next session

> I want to pick up the "upload scorecard image → LLM parse → create course"
> feature. Read `scorecards/ADD_COURSE_FLOW.md` for the full plan, the schema
> changes already made, the "Unknown tee" legacy state, and the Phase 1
> results. The AI SDK + Vercel AI Gateway packages are installed, OIDC auth
> is wired up, and the parsing spike is done (Gemini 3.1 Flash-Lite at
> 99.61% accuracy). Skip env/install setup.
>
> Jump straight to **Phase 2: Upload + storage plumbing**. Start by lifting
> the parser out of `scripts/spike-parse-scorecard.ts` into
> `lib/scorecard-parser.ts` so the spike and the new server action share one
> source of truth (Zod schema, system/user prompts, `verifySums`, and a
> `parseScorecardImage(buffer, mediaType, model?)` function that returns
> `{ parsed, sumChecks, usage }`). Then propose the UI shape — likely a new
> "Upload scorecard" tab inside `app/(app)/admin/_components/course-sheet.tsx`
> — and a `parseScorecardFromUrl(blobUrl)` server action in
> `app/(app)/admin/actions.ts`. For v0, render the parsed JSON in the sheet;
> the editable confirm form is Phase 3.
