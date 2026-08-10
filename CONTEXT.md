# Open Caddie

Open Caddie records golf courses, rounds, matches, tournaments, and club standings.

## Language

**Scramble**:
A one-off, Club-less golf event in which each team records one gross score per hole. It belongs to no Season, contributes to no standings or Player Index, and is modeled separately from a Tournament.

**Scramble Team**:
A named, variable-size roster of people who play and score together in one Scramble. Members are names, not Users.

**Team Score**:
One Scramble Team's gross strokes recorded for one hole.

**Starting Hole**:
The hole where a Scramble Team begins play in a shotgun start.

**Season**:
A numbered, Club-owned collection of Tournaments whose results contribute to one standings table. Numbers begin at 1 and have no calendar meaning; every Tournament belongs to exactly one Season.
_Avoid_: Tournament group, date range

**Current Season**:
A Club's highest-numbered Season. A Club has exactly one once it has any Season, and none before that; it is never repointed at a lower-numbered Season. New Tournaments default to it.

**Past Season**:
Any Season below its Club's highest-numbered Season. Past Seasons remain editable and may receive Tournaments.
_Avoid_: Archived Season

**Course Scorecard Import**:
A resumable process for turning a course scorecard image into data for either a new or existing course. A new-course import creates tees and holes; an existing-course import preserves historical hole data and the identities of tees referenced by past play, and requires an explicit disposition for every Placeholder Tee.
_Avoid_: Scorecard reconciliation, scorecard sync

**Round Scorecard Import**:
A process for turning an image of a played scorecard into per-hole scores for existing rounds.
_Avoid_: Round Scorecard Upload (when referring to the full process rather than image transfer)

**Placeholder Tee**:
An unidentified tee retained to preserve its association with historical rounds or tournaments. During an existing-course import, it is explicitly mapped to an imported tee or kept unchanged.
_Avoid_: Unknown tee, temporary tee

## Handicap

**Score Differential**:
A single prior round's scoring result, adjusted for course difficulty. The raw input to a Player Index.

**Player Index**:
A player's handicap index. Normally computed as the average of the best 2 of their last 4 Score Differentials, but a round may carry a hand-entered Player Index Override.
_Avoid_: handicap index, GHIN

**Player Index Override**:
A Player Index entered by hand on a round — used for casual match play instead of a computed one. Scaled by course slope into a Course Handicap like any Player Index; it is not applied to net strokes directly.
_Avoid_: handicap index override, playing handicap override

**Course Handicap**:
A Player Index scaled to one course's slope — the strokes received on that course. This codebase applies no allowance or rounding.

**Playing Handicap**:
The Course Handicap actually applied to compute a round's net strokes. Resolved per round: a Player Index Override's Course Handicap takes precedence over a computed one.
_Avoid_: tournament handicap (a legacy field name for the computed Course Handicap — not a general term; it also appears outside tournaments).

## Match scoring

**Match Play**:
A per-hole game in which the unique lowest net team score wins the hole. Singles and Three-Ball use 100% relative Playing Handicaps; Four-Ball uses 90% relative Playing Handicaps.

**Skins**:
A per-hole game using relative Playing Handicaps. A unique low net score wins the hole; tied completed holes carry their skins forward until a later unique low net score wins them.
