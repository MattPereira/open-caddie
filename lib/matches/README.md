# Match scoring

`scoreMatchPlay` and `scoreSkins` in `scoring.ts` are independent pure calculations.
Readers supply already-assessed Playing Handicaps, hole handicaps and recorded
scores. Results contain identities and scoring data; UI adapters add names,
images and wording. The low-level evaluator is private.

Match Play returns `unavailable` with a reason or `ready` with contests. Singles
and Four-Ball return one contest; Three-Ball returns A–B, A–C and B–C, each with
its own relative handicap baseline. Each contest includes hole winners, player
strokes, holes won, progress and close-out state.

`matchFormatPolicy` in `formats.ts` owns format counts and allowances. Creation
and scoring require the exact count. Editing Singles/Three-Ball only enforces
the cap; Four-Ball requires two teams of two. Skins scores individuals at 100%,
independently of Four-Ball's 90% Match Play allowance. Field Skins remains separate.

## Deferred scoring corrections

This extraction preserves existing behavior. These changes need separate fixes
and regression tests against the intended rules:

- Freeze the result at the first close-out; earlier score corrections may
  recompute it. Currently later holes can change a decided result.
- Mark Four-Ball outcomes provisional while partner scores are missing.
  Currently one recorded score per team can produce an unmarked winner.
- Use the full Skins roster for handicap allowances and await everyone's score
  before awarding a hole. Currently unstarted players are excluded, so their
  first scores can change earlier results.

Tests cover agreed rules through the public scoring functions. The deferred
behaviors are not asserted as the correct rules.
