# Open Caddie

Open Caddie records golf courses, rounds, matches, tournaments, and club standings.

## Language

**Course Scorecard Import**:
A resumable process for turning a course scorecard image into data for either a new or existing course. A new-course import creates tees and holes; an existing-course import preserves historical hole data and the identities of tees referenced by past play, and requires an explicit disposition for every Placeholder Tee.
_Avoid_: Scorecard reconciliation, scorecard sync

**Placeholder Tee**:
An unidentified tee retained to preserve its association with historical rounds or tournaments. During an existing-course import, it is explicitly mapped to an imported tee or kept unchanged.
_Avoid_: Unknown tee, temporary tee
