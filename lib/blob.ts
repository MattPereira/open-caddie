import { del } from "@vercel/blob";

export function isVercelBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function safeDeleteBlob(url: string | null | undefined) {
  if (!isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (error) {
    console.error("safeDeleteBlob failed", { url, error });
  }
}
