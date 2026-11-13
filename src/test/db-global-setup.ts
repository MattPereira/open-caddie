import type { TestProject } from "vitest/node";

// Fail, never skip: a db run without a database would be a green run that
// proved nothing.
export default function setup(project: TestProject) {
  if (!project.config.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must be set (in the environment or .env.test) to run the db project",
    );
  }
}
