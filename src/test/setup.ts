import { vi } from "vitest";

// server-only throws unless resolved with Next's `react-server` condition,
// which vitest doesn't set. The Next build and the depcruise index-runs-anywhere
// rule own the client/server boundary, so tests don't need to.
vi.mock("server-only", () => ({}));
