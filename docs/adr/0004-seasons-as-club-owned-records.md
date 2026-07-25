# Model Seasons as Club-owned records

Replace the nullable season number on each Tournament with a required reference to a Season record owned by a Club. A Season has a permanent Club-relative sequential number and may be current or past; this supports empty Seasons, enforces at most one current Season per Club, and makes the Tournament's Club derivable through its Season without calendar boundaries.

## Considered Options

Keeping `club_id` and a season number on each Tournament was simpler, but could not represent an empty Season or enforce its lifecycle without duplicating Club/Season relationships. Date-derived Seasons were rejected because this Club's September boundary would add configuration and date-entry constraints without improving the creation workflow.

## Consequences

- Every Tournament must reference exactly one Season.
- Season numbers are unique within a Club and begin at 1.
- New Tournaments visibly default to the Club's current Season; starting the next Season requires confirmation and atomically creates both the Season and Tournament.
- Past Seasons remain editable. Only an empty highest-numbered Season may be deleted.
- Club standings show only Seasons containing at least one Tournament and default to the newest non-empty Season.
- Existing `(club_id, season)` pairs migrate to Season records; each Club's highest existing number becomes current.
