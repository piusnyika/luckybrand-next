import { NextRequest } from "next/server";
import { createReadStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
const ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "storage", "uploads"));
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".avif": "image/avif", ".pdf": "application/pdf", ".mp4": "video/mp4", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".css": "text/css",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map((p) => decodeURIComponent(p));
  const file = path.resolve(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).toLowerCase();
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });
  let st; try { st = statSync(file); if (!st.isFile()) throw 0; } catch { return new Response("Not found", { status: 404 }); }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: { "Content-Type": TYPES[ext], "Content-Length": String(st.size), "Cache-Control": "public, max-age=31536000, immutable",
      // an SVG can contain scripts: never let one run as part of this site
      ...(ext === ".svg" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}) },
  });
}
