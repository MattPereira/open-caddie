# Matches Rollout Plan

## 1. Matches MVP

- [x] Add a `/matches` navigation item.
- [x] Add `db/queries/matches.ts`.
- [x] Add a matches list page grouped as Live, Upcoming, and Past.
- [x] Add a shared event card for course/name/date/player count display.
- [x] Add a match detail page with Rounds and Greenies tabs.
- [x] Add create, edit, and add-player flows if the existing tournament flow gives us a clean pattern.

## 2. Shared Event UI Cleanup

- [x] Extract event-neutral score table and tab components from tournament detail.
- [x] Rename shared score concepts from tournament-specific terms to event-neutral terms, such as `playingHandicap` or `courseHandicap`.
- [x] Keep tournament-specific copy in tournament routes.
- [x] Keep match-specific copy in match routes.

## 3. Match Scoring

- [x] Add a Match Play tab for 1v1 matches derived from round scores.
- [x] Build match-play scoring around derived teams, even for 1v1 matches, so the UI and evaluator can grow into 2v2 best-ball matches later.
- [x] For 1v1 MVP, derive two one-player teams from the two match rounds.
- [x] Use standard relative match-play handicap allocation: the lowest playing handicap plays off zero, and other players receive the difference.
- [x] Allocate received strokes on the hardest handicap holes first, using each hole's course handicap value.
- [x] Use 100% allowance for singles match play.
- [x] Leave room for 2v2/four-ball match play to use a 90% allowance later.
- [x] Compare adjusted or net hole scores for each hole.
- [x] Show per-hole outcomes: Player A wins, Player B wins, or tied.
- [x] Show running match status such as `A 1 up`, `Tied`, or `B 2 up`.
- [x] Include a concise explanation paragraph on the Match Play tab explaining that strokes are allocated from the handicap difference and applied to the hardest holes.
- [x] Show each player's gross score, received stroke indicator, adjusted/net hole score, hole winner, and running match status.

## 4. Skins Scoring

- [x] Add a Skins tab or section for matches using match handicap values.
- [x] Support individual skins for any number of match players; skins are not limited to 1v1.
- [x] Use net skins by default.
- [x] Use relative handicap allocation: the lowest playing handicap plays off zero, and higher-handicap players receive the difference.
- [x] Allocate received strokes on the hardest handicap holes first, using each hole's course handicap value.
- [x] Award a skin only when exactly one player has the lowest adjusted/net score on a hole.
- [x] Treat tied low scores as no skin awarded for that hole.
- [x] Leave room for carryover skins later, but the first pass can simply show tied/no-skin holes.
- [x] Leave room for a future gross/net skins toggle.
- [x] Leave room for future skins handicap allowances such as 100%, 75%, or 50%.
- [x] Include a concise explanation paragraph on the Skins tab explaining that the lowest-handicap player plays off zero, other players receive the difference, and skins require a unique low net score.

## 5. 2v2 Schema

- [ ] Add team schema when actual team match play is ready.
- [ ] Add `match_teams` with `id`, `match_id`, `name`, and optional `sort_order`.
- [ ] Add `match_team_members` with `match_team_id` and either `round_id` or `user_id`.
- [ ] Consider adding `matches.format`, such as `individual_match_play` or `team_best_ball`.
- [ ] Keep player scorecards represented by `rounds`.
- [ ] Keep teams as a match-level concept.
