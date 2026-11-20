// Stand-ins for two Next-only modules the seed reaches through module entry
// points. `server-only` throws unless Next resolves it. next/cache's
// revalidate functions throw outside a Next request, and the seed has no pages
// to revalidate. The `react-server` condition would fix the first, but it
// also swaps in React's server build, which breaks next/navigation.
const STUBS = {
  "server-only": new URL("./server-only.mjs", import.meta.url).href,
  "next/cache": new URL("./next-cache.mjs", import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  const stub = STUBS[specifier];
  if (stub) return { url: stub, shortCircuit: true };
  return nextResolve(specifier, context);
}
