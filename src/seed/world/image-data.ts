import type { PlayerKey } from "./players";

export const PLAYER_IMAGES = {
  panther: "/seed/players/panther-woods.webp",
  john: "/seed/players/john-nightly.webp",
  scottie: "/seed/players/scottie-shuffler.webp",
  rory: "/seed/players/rory-mceagle.webp",
  phil: "/seed/players/phil-nickelson.webp",
  tyson: "/seed/players/tyson-deshambles.webp",
  rivers: "/seed/players/rivers-koepka.webp",
  dustin: "/seed/players/dustin-thomas.webp",
  justin: "/seed/players/justin-johnson.webp",
  jordan: "/seed/players/jordan-slice.webp",
  rickie: "/seed/players/rickie-fowleri.webp",
  bubba: "/seed/players/bubba-wattson.webp",
  arnold: "/seed/players/arnold-lemonade.webp",
  jack: "/seed/players/jack-nickel.webp",
  jon: "/seed/players/jon-ram.webp",
  vijay: "",
  collin: "/seed/players/collin-mulligan.webp",
  max: "",
  adam: "",
} satisfies Record<PlayerKey, string>;

export const COURSE_IMAGES: Record<string, string> = {
  "pebble-beach": "/seed/courses/pebble-beach.webp",
  "tpc-sawgrass": "/seed/courses/tpc-sawgrass.webp",
  "kapalua-plantation": "/seed/courses/kapalua-plantation.webp",
  "mauna-kea": "/seed/courses/mauna-kea.webp",
  "bethpage-black": "",
  "royal-county-down": "/seed/courses/royal-county-down.webp",
};

export const CLUB_IMAGES: Record<string, string> = {
  "mulligan-mafia": "/seed/clubs/mulligan-mafia.webp",
  "handicap-hustlers": "",
};
