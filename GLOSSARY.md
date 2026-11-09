# Open Caddie

Open Caddie records golf courses, rounds, matches, tournaments, and club standings.

## Language

**Player**:
A person known to Open Caddie, whether or not they have ever signed in. The golf-facing view of a person: they play Rounds, create Matches, belong to Clubs, and carry a Player Index.
_Avoid_: User (outside sign-in), golfer, member (for the person itself)

**User**:
A Player's sign-in identity: how a person authenticates and holds a session. Used only when talking about signing in.
_Avoid_: User as a synonym for Player, account (for the person itself)

**Admin**:
A Player permitted to manage any Club, Tournament, Match, Round or Player. Admin is a trait of the Player, not of their sign-in.

**Club Member**:
A Player's membership in a Club. The people themselves are the Club's Players.
_Avoid_: member (for the Player)

**Tournament**:
A Club-owned competition belonging to exactly one Season, whose Rounds feed that Season's standings and its players' Player Indexes.

**Round**:
One player's play of one course on one date, casual or within an event (a Tournament or a Match). A Round's course and date follow its event; its tee starts as the event's and is the player's to change. An event's course cannot change once any Round has scores or Greenies.

**Match**:
An event created by one Player, its creator, holding the Rounds of the Players in it. Its format caps its Rounds: Singles at 2, Three-Ball at 3, and Four-Ball needs exactly 4. Only its creator or an Admin may change or delete it.

**Match Team**:
One of the two sides in a Four-Ball Match, each holding two of its Rounds.
_Avoid_: pair, side

**Season**:
A numbered, Club-owned collection of Tournaments whose results contribute to one standings table. Numbers begin at 1 and have no calendar meaning; every Tournament belongs to exactly one Season.
_Avoid_: Tournament group, date range

**Current Season**:
A Club's highest-numbered Season. A Club has exactly one once it has any Season, and none before that; it is never repointed at a lower-numbered Season. New Tournaments default to it.

**Past Season**:
Any Season below its Club's highest-numbered Season. Past Seasons remain editable and may receive Tournaments.
_Avoid_: Archived Season

**Pairing**:
An Admin-defined set of up to four Rounds within one Tournament, representing the Players who are playing together. Its Players may enter each other's scores.
_Avoid_: Tournament group (already a rejected synonym for Season), foursome (a Pairing may hold fewer than four)

**Scorer**:
Someone who may enter a Round's per-hole scores and Greenies: the Round's Player, an Admin, the Round's Pairing mates, and, for a Match Round, the Match's other Players and its creator. Only the Round's Player or an Admin may change the Round itself (its tee, its Player Index Override, or deleting it).
_Avoid_: peer scorer, scorekeeper

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
A player's handicap index. For a Tournament Round, computed as the average of the best 2 of their last 4 Score Differentials from the player's complete Tournament Rounds in the same Club; a Match Round instead carries a hand-entered Player Index Override.
_Avoid_: handicap index, GHIN

**Player Index Override**:
A Player Index entered by hand on a Match Round — used for casual match play instead of a computed one. Only Match Rounds may carry one. Scaled by course slope into a Course Handicap like any Player Index; it is not applied to net strokes directly.
_Avoid_: handicap index override, playing handicap override

**Course Handicap**:
A Player Index scaled to one course's slope — the strokes received on that course. This codebase applies no allowance or rounding.

**Playing Handicap**:
The Course Handicap applied to a Round's net strokes, set by its event: a Tournament Round's comes from its computed Player Index (scratch until it has 2 prior Rounds); a Match Round's from its Player Index Override (scratch if none); a casual Round has none.
_Avoid_: tournament handicap (a legacy field name for the computed Course Handicap — not a general term; it also appears outside tournaments).

## Match scoring

**Match Play**:
A per-hole game in which the unique lowest net team score wins the hole. Singles and Three-Ball use 100% relative Playing Handicaps; Four-Ball uses 90% relative Playing Handicaps.

**Greenie**:
A closest-to-the-pin result on a par 3, recorded as the distance from the hole. Each recorded Greenie earns standings points by distance tier, whether or not it is the closest on its hole.
_Avoid_: Closie, CTP

**Skins**:
A per-hole game using relative Playing Handicaps. A unique low net score wins the hole; tied completed holes carry their skins forward until a later unique low net score wins them. Played in Matches.
_Avoid_: tournament skins

## Tournament results

**Field Skins**:
A Tournament's per-hole game across its complete Rounds. Each player gets one stroke on holes whose handicap is at most half their Playing Handicap, rounded down. A unique low net score wins the hole; ties are dead, with no carry-over. A hole any complete Round did not score is not played. Field Skins earn no standings points.
_Avoid_: Skins, tournament skins

**Tournament ranking**:
Strokes rank complete Rounds by net, then gross. Putts rank complete Rounds with all 18 putts recorded by putts, then net, then gross. Remaining ties break by player last name, first name, username. Standings position points follow this order exactly; tied Rounds do not share points.
