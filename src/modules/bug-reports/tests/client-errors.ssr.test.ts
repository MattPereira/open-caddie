// @vitest-environment node
import { expect, it } from "vitest";

import { startCapturingClientErrors } from "../client";

// The client component that starts capture also runs during server render.
it("does nothing on the server, where there is no window", () => {
  expect(() => startCapturingClientErrors()).not.toThrow();
});
