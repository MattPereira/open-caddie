import { updateTag } from "next/cache";

export const HOME_EVENTS_CACHE_TAG = "home-events";

export function invalidateHomeEventsCache() {
  updateTag(HOME_EVENTS_CACHE_TAG);
}
