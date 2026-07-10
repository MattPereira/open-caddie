---
status: accepted
date: 2026-07-10
---

# Server-owned Course Scorecard Imports

Course Scorecard Imports are persisted, resumable server-side workflows behind one deep module. The module exposes two interfaces: a workflow interface (`start`, `inspect`, `continue`) that drives a single import through its lifecycle, and a maintenance interface (`cleanup`, `cleanupSystem`) that performs operational upkeep — expiring inactive imports and retrying deferred staged-image deletion — across all imports, not scoped to any one workflow. Clean imports publish automatically via the workflow interface, while unsafe imports pause for explicit admin input. New- and existing-course changes publish atomically, and existing-course imports preserve historical hole data and referenced tee identities.

## Considered options

- Client-owned drafts were rejected because workflow rules and recovery leak into forms.
- Progressive writes were rejected because existing courses can become partially updated.
- Stateless retries were rejected because missing metadata and review decisions must survive refreshes.
- Folding cleanup into `continue`'s intent union was rejected because cleanup isn't scoped to a single import; it operates across all imports and has no natural `importId` to hang off of.

## Consequences

This concentrates policy and tests at one interface and prevents partial publication. It requires persisted import state, staged-image ownership, concurrency checks, expiry cleanup, and more server-side implementation.
