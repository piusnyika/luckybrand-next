import "server-only";
// Simple in-memory limiter (per server process). Good enough for a single Node instance.
const hits = new Map<string, number[]>();
/** The visitor's address as seen by our own web server, which adds it last (earlier entries can be faked by the visitor) */
export const clientIp = (h: Headers) => (h.get("x-forwarded-for") || "").split(",").at(-1)!.trim() || "local";

export async function rateLimit(key: string, max: number, windowSec: number) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter((t) => now - t < windowSec * 1000);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowSec * 1000) hits.delete(k);
  return arr.length <= max;
}
