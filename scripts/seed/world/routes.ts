/** A page the seed filled, and what an agent finds on it. */
export type SeededRoute = { path: string; shows: string };

export function seedRoutesFile(env: Record<string, string | undefined>) {
  return env.SEED_ROUTES_FILE ?? "/tmp/seed-routes.txt";
}

export function scoringProgress(holesScored: number) {
  if (holesScored === 0) return "upcoming, no scores";
  if (holesScored < 18) return `live, ${holesScored} holes scored`;
  return "completed";
}

export function formatSeededRoutes(routes: SeededRoute[]) {
  const width = Math.max(...routes.map((route) => route.path.length));
  return routes
    .map((route) => `${route.path.padEnd(width)}  ${route.shows}\n`)
    .join("");
}
