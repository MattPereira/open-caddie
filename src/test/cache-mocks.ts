import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { vi } from "vitest";

/** Forgets cache invalidations so far, e.g. ones a test's arrange made. */
export function clearCacheMocks() {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(revalidateTag).mockClear();
  vi.mocked(updateTag).mockClear();
}
