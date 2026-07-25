# Model Seasons as Club-owned records

Replace the nullable season number on each Tournament with a required reference to a Season record owned by a Club. A Season has a permanent Club-relative sequential number; a Club's current Season is its highest-numbered one and every lower-numbered Season is past. This supports empty Seasons and makes the Tournament's Club derivable through its Season without calendar boundaries.

## Considered Options

Keeping `club_id` and a season number on each Tournament was simpler, but could not represent an empty Season or enforce its lifecycle without duplicating Club/Season relationships. Date-derived Seasons were rejected because this Club's September boundary would add configuration and date-entry constraints without improving the creation workflow.

Storing which Season is current, so a Club could point it back at a lower-numbered Season, was rejected: Season numbers carry no calendar meaning, Past Seasons already remain editable and may receive Tournaments, and a Tournament belonging to an earlier Season can simply select it. Stored currency would duplicate what the highest number already says and would need its own constraint to stay single.

## Consequences

- Every Tournament must reference exactly one Season.
- Season numbers are unique within a Club and begin at 1.
- New Tournaments visibly default to the Club's current Season; starting the next Season requires confirmation and atomically creates both the Season and Tournament.
- Past Seasons remain editable. No Season deletion is offered, and this is a product decision rather than a schema constraint: deleting a Club's highest-numbered Season is the one operation that would move its Current Season backwards, so reintroducing deletion means revisiting this ADR.
- Club standings show only Seasons containing at least one Tournament and default to the newest non-empty Season.
- Existing `(club_id, season)` pairs migrate to Season records; each Club's highest existing number is therefore its current Season.

## Amendments

Currency was originally stored on each Season and constrained to one per Club. Because every write path pinned it to the highest number, it was redundant with the number itself and was removed; uniqueness of `(club_id, number)` now carries the guarantee. The decision and Considered Options above reflect the amended model.

Season deletion was originally allowed for an empty highest-numbered Season and has since been removed. Its absence is what keeps a Club's highest Season number monotonic, and therefore what makes deriving the Current Season from it safe.
