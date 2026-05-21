# Matches Rollout Plan

## 1. Matches MVP

- [x] Add a `/matches` navigation item.
- [x] Add `db/queries/matches.ts`.
- [x] Add a matches list page grouped as Live, Upcoming, and Past.
- [x] Add a shared event card for course/name/date/player count display.
- [x] Add a match detail page with Rounds and Greenies tabs.
- [x] Add create, edit, and add-player flows if the existing tournament flow gives us a clean pattern.

## 2. Shared Event UI Cleanup

- [ ] Extract event-neutral score table and tab components from tournament detail.
- [ ] Rename shared score concepts from tournament-specific terms to event-neutral terms, such as `playingHandicap` or `courseHandicap`.
- [ ] Keep tournament-specific copy in tournament routes.
- [ ] Keep match-specific copy in match routes.

## 3. Match Scoring

- [ ] Add a Skins tab or section for matches using match handicap values.
- [ ] Add a Match Play tab for 1v1 matches derived from round scores.
- [ ] Compare adjusted or net hole scores for each hole.
- [ ] Show per-hole outcomes: Player A wins, Player B wins, or tied.
- [ ] Show running match status such as `A 1 up`, `Tied`, or `B 2 up`.

## 4. 2v2 Schema

- [ ] Add team schema when actual team match play is ready.
- [ ] Add `match_teams` with `id`, `match_id`, `name`, and optional `sort_order`.
- [ ] Add `match_team_members` with `match_team_id` and either `round_id` or `user_id`.
- [ ] Consider adding `matches.format`, such as `individual_match_play` or `team_best_ball`.
- [ ] Keep player scorecards represented by `rounds`.
- [ ] Keep teams as a match-level concept.
