# Course forms refactor — pickup

> Drop this file into a fresh Claude session to resume work. Background context lives in `scorecards/ADD_COURSE_FLOW.md` (still accurate for parser/schema/Unknown-tee facts).

## What we're doing

Replacing the old admin "Course sheet" with two dedicated pages, plus wiring scorecard-image parsing into course creation. Architectural shift: **all entry points are contextual** (on `/courses` list, on `/courses/[handle]` detail) — no more centralized `/admin` hub for editing courses. Admin gate is per-button, not per-route.

## Direction decisions (confirmed)

- **`/courses/new`** is an **optimistic minimal form**: course name + course image + scorecard image. Server slugifies handle, parses scorecard via Gemini Flash-Lite, inserts tees + yardages + holes in one tx. Manual-only create is gone.
- **`/courses/[handle]/edit`** is the **review/fix surface**: full multi-tee editor. This is where Phase 3 of the original plan now lives.
- **Optimistic save:** parse failures only block on hard errors (no parse possible). Sum-check failures still save — they redirect the user to `/edit` so they can review. Per-cell warnings on edit page are still TODO.
- **Blob orphan story:** images upload on crop (not on submit). Cancel button + per-replace tracking cleans up draft blobs. Tab-close/crash escapes — see `memory/project_blob_orphan_cleanup.md` for the planned cron sweep.
- **Tee color** is a free text string (DB column is `text`), not a closed enum. The parser still emits a constrained set; the form stores whatever comes back.

## Done

### Parser lifted

- `lib/scorecard-parser.ts` — single source for `ScorecardSchema`, `SYSTEM_PROMPT`, `USER_PROMPT`, `verifySums`, `parseScorecardImage(buffer, mediaType, model?)`. Default model `google/gemini-3.1-flash-lite`.
- `scripts/spike-parse-scorecard.ts` imports from there. Spike re-run was blocked on stale OIDC token but typecheck-equivalent.

### Schema + queries

- `app/(app)/courses/schema.ts`
  - `CourseFormSchema` — multi-tee, optional yardage cells (legacy Unknown tees can save with blanks), handicap-permutation refine, unique-tee-name refine.
  - `CourseUpdateSchema` = form schema + id.
  - `CourseCreateInputSchema` — minimal `{ name, imgUrl, scorecardImgUrl }` for the optimistic flow.
- `db/queries/courses.ts` — `getCourseForEdit(handle)` returns `{ id, handle, name, imgUrl, scorecardImgUrl, tees: [{id, name, color, rating, slope, sortOrder, yardages: (number|null)[18]}], holes }`. Cached.

### Server actions (`app/(app)/courses/actions.ts`)

- `createCourse({ name, imgUrl, scorecardImgUrl })`:
  - Slugifies → handle collision check → fetch scorecard bytes → `parseScorecardImage` → insert course + tees + yardages + holes in one tx.
  - Returns `{ ok, handle, sumCheckIssues }`. Parse failure → no DB writes.
- `updateCourse({ ...form, id })`:
  - Diffs tees by id. New tees insert. Removed tees deleted (with FK pre-check against `tournaments`/`rounds` — friendly error listing block counts per tee).
  - Replaces yardages per tee (delete-then-insert non-blanks). Replaces holes (delete-then-insert).
  - Blob cleanup on imgUrl/scorecardImgUrl changes.
  - Returns `{ ok, handle, renamed }`.
- `deleteCourse(id)` — tournament/round guard + blob cleanup.
- `deleteDraftBlobs(urls[])` — admin-only, only deletes blobs whose path starts with `courses/draft-` (used by create form on Cancel + on replace).

### Image components

- `components/image-cropper-dialog.tsx` — `aspectRatio` is now optional. Undefined = free-form crop (used for scorecard).
- `components/image-upload-field.tsx` — new `freeform` variant, accepts optional `aspectRatio` for the preview box only (cropper stays free-form). Accepts `title` + `description` props for header text. Layout for non-avatar variants: title/description on top, preview, then buttons row below. `wide` variant preview is full-width (no more 50% split).

### Create form (`/courses/new`)

- `app/(app)/courses/_components/course-create-form.tsx`
  - Three fields: name (half-width on md+), course image (16:9 wide), scorecard image (16:9 freeform). Both image fields side-by-side at md+.
  - Tracks every uploaded URL in a Set so replaces + cancels both clean up.
  - On submit: redirects to `/courses/<handle>` on clean parse, `/courses/<handle>/edit` if sum-checks failed.
  - Big "Cancel" + "Submit" buttons full-width on mobile, auto-width right-aligned on sm+.

### Edit form (`/courses/[handle]/edit`)

- `app/(app)/courses/_components/course-form.tsx` — edit-only (`mode` prop dropped).
- Page title: "Edit course".
- Layout: name + handle side-by-side on md+. Course image + scorecard image side-by-side on md+.
- Tees: stacked cards rendered from existing data. Each card has name, color, rating, slope inputs. **No add/remove tee, no yardage inputs yet.** Yardages preserved in form state so saves don't wipe them.
- Holes: two cards ("Front" / "Back" — labels live inside the card on the same row as Par/Handicap column headers). Each row is full-width par + handicap inputs with `text-center`. Out/In subtotals shown via disabled `<Input>` matching hole-row layout. No grand total row. Handicap has no totals shown.

## Not done — what to build next

### Step 4: Multi-tee repeater + yardage grid (NEXT)

Where: `app/(app)/courses/_components/course-form.tsx`

- Add "Add tee" button → `append` empty tee to `useFieldArray`.
- Add per-tee "Remove" button → `remove(index)`. Confirm-on-remove if the tee has yardages. Server action already blocks removal if FK-bound.
- Render the 18 yardage inputs per tee. Open Q: layout. Options:
  - Grid 9×2 (Out row above In row), labeled by hole.
  - Two columns matching the Holes section's Front/Back split.
  - Vertical list with hole labels — uniform with the existing Tees card vertical rhythm but tall.
  - Tee-color tint / collapse to compact in summary mode (long courses with 4–7 tees).
- Sum-check warnings (Out/In/TOT mismatches) should be surfaced inline once UI is in place — currently they only show by being saved server-side; expose them on the edit page next session.

### Step 5: Entry buttons + cutover

- `/courses/page.tsx` — admin-only "Add course" button → `Link href="/courses/new"`.
- `/courses/[handle]/page.tsx` — admin "Edit" button currently opens the old admin sheet via `_components/edit-course-button.tsx`. Replace with a `Link href="/courses/[handle]/edit"`.
- Delete:
  - `app/(app)/admin/_components/course-sheet.tsx`
  - `app/(app)/admin/_components/courses-panel.tsx` (or trim it out of admin tabs)
  - The `courses` tab from `app/(app)/admin/_components/admin-tabs.tsx`
  - `createCourse` / `updateCourse` / `deleteCourse` in `app/(app)/admin/actions.ts`
  - Course schemas in `app/(app)/admin/schema.ts`
- `app/(app)/courses/[handle]/_components/edit-course-button.tsx` becomes a `<Link>` (or remove entirely if not needed).

### Step 6: Unsaved-changes guard

`useBeforeUnload` + router-intercept on edit page + Cancel button. Tackle last — fiddly.

## Open questions

- **Yardage grid layout** (see Step 4 above). Pick one before coding.
- **Sum-check warning surfacing** on edit page: inline next to inputs? Top-of-page banner? Both? Decide before Step 4 wraps.
- **Re-uploading scorecard image in edit mode** currently just stores a new URL — doesn't re-parse or reconcile with existing tees. The reconciliation matrix from `ADD_COURSE_FLOW.md` (Unknown-tee replacement, multi-tee diffing) is still Phase 3+ work; defer until a real user need.
- **Existing-course / no-tees state**: a legacy course with the "Unknown" tee but no yardages will render in edit form fine, but the user can only edit name/color/rating/slope of the Unknown tee until Step 4 lands.

## Files to know

Active in this refactor:
- `lib/scorecard-parser.ts` — parser
- `db/schema.ts`, `db/queries/courses.ts` — DB
- `app/(app)/courses/schema.ts` — form Zod
- `app/(app)/courses/actions.ts` — server actions
- `app/(app)/courses/_components/course-create-form.tsx` — create form
- `app/(app)/courses/_components/course-form.tsx` — edit form
- `app/(app)/courses/new/page.tsx`, `app/(app)/courses/[handle]/edit/page.tsx` — pages
- `components/image-upload-field.tsx`, `components/image-cropper-dialog.tsx` — image picker

To delete in Step 5:
- `app/(app)/admin/_components/course-sheet.tsx`
- `app/(app)/admin/_components/courses-panel.tsx`
- Course-related code in `app/(app)/admin/{actions,schema}.ts`
- `app/(app)/courses/[handle]/_components/edit-course-button.tsx` (replace with Link)

## Starter prompt for next session

> Resuming the course-forms refactor — read `PLAN_COURSE_FORMS.md` for the current state. Done: parser lift, schema, actions, optimistic create form, edit form shell with multi-tee preserved-but-not-yet-editable. **Next is Step 4 (tee repeater + yardage grid in `app/(app)/courses/_components/course-form.tsx`).** Before coding, ask me which yardage-grid layout to use (see the open question in the plan).
