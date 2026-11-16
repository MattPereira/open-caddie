import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// Stryker's vitest runner has no project filter, and with coverage analysis
// off it runs the whole suite per mutant. Keep only the `unit` project so
// runs stay fast and don't need Postgres.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: base.test?.projects?.filter(
      (project) =>
        typeof project === "object" &&
        "test" in project &&
        project.test?.name === "unit",
    ),
  },
});
