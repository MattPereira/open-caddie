// For the Tournament and Match writes only: they call these inside their own
// transaction, then refresh the Rounds they changed after commit.
export {
  deleteEventRounds,
  EventCourseLockedError,
  insertEventRounds,
  invalidateRoundChanged,
  syncEventRounds,
  type ChangedRound,
  type EventRef,
} from "./lib/lifecycle";
