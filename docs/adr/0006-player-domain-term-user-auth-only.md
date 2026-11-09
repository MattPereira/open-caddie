# Player is the domain term; User is reserved for sign-in

Every person in Open Caddie is a Player, including people who have never signed in. "User" refers only to a Player's sign-in identity: the Auth.js `user`, `account`, `session` and verification-token tables, plus session and magic-link code. Golf tables reference the person through `player_id`-style columns that point at the Auth.js `user` table's id. The person lives in that table because Auth.js requires it, not because the domain calls them a User.

## Considered Options

Renaming the Auth.js `user` table, and its `userId` references in `account` and `session`, to `player` was rejected because it requires custom adapter table mappings that fight Auth.js conventions, for no domain benefit. Using User everywhere was rejected: Player Index, Playing Handicap and the Players UI already say Player, so code and screens would disagree permanently, and Players who never sign in would be "Users" who never use the app. A separate User concept for non-playing people (organizers, spectators) is not planned. If one ever appears, it gets its own term rather than widening User.

## Consequences

- A golf table holding a `player_id` that references `"user".id` is deliberate.
- Admin is a trait of the Player even though it is stored on the Auth.js `user` row.
- Code resolves the session to a Player at the boundary (`getCurrentPlayer`). Code past that boundary says Player.
