# Open Caddie

Open Caddie records golf courses, rounds, matches, tournaments, and club standings.

## Language

**Course Scorecard Import**:
A resumable process for turning a course scorecard image into data for either a new or existing course. A new-course import creates tees and holes; an existing-course import preserves historical hole data and the identities of tees referenced by past play, and requires an explicit disposition for every Placeholder Tee.
_Avoid_: Scorecard reconciliation, scorecard sync

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
_Note_: persisted as the legacy column `handicapIndexOverride` (rename pending).

**Course Handicap**:
A Player Index scaled to one course's slope — the strokes received on that course. This codebase applies no allowance or rounding.

**Playing Handicap**:
The Course Handicap actually applied to compute a round's net strokes. Resolved per round: a Player Index Override's Course Handicap takes precedence over a computed one.
_Avoid_: tournament handicap (a legacy field name for the computed Course Handicap — not a general term; it also appears outside tournaments).
