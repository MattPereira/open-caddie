import { beforeEach, vi } from "vitest";

import { clearCacheMocks } from "./cache-mocks";

// server-only throws unless resolved with Next's `react-server` condition,
// which vitest doesn't set. The Next build and the depcruise index-runs-anywhere
// rule own the client/server boundary, so tests don't need to.
vi.mock("server-only", () => ({}));

// Writes invalidate Next's cache, which has no request context in tests. Tests
// that assert invalidations import these mocks from "next/cache".
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}));

beforeEach(clearCacheMocks);
