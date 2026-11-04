import "server-only";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { imageSize } from "image-size";
import { prisma, Prisma } from "@/lib/prisma";
import { slugify } from "../format";

const ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "storage", "uploads"));
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif", "application/pdf"];

export async function saveUpload(file: File, alt = "") {
  if (!ALLOWED.includes(file.type)) throw new Error(`File type ${file.type || "unknown"} is not allowed`);
  if (file.size > 15 * 1024 * 1024) throw new Error("File is larger than 15 MB");
  const now = new Date();
  const dir = path.join(ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  await mkdir(dir, { recursive: true });
  const ext = (path.extname(file.name) || "." + file.type.split("/")[1]).toLowerCase().replace("jpeg", "jpg").replace("+xml", "");
  const base = slugify(path.basename(file.name, path.extname(file.name))) || "file";
  // random part too: parallel imports can save two files with the same name in the same millisecond
  const name = `${base}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  let width: number | null = null, height: number | null = null;
  try { const d = imageSize(buf); width = d.width ?? null; height = d.height ?? null; } catch {}
  const url = "/uploads/" + path.relative(ROOT, path.join(dir, name)).split(path.sep).join("/");
  const r = await prisma.media.create({ data: { url, alt, title: base.replace(/-/g, " "), mime: file.type, width, height, size: file.size }, select: { id: true } });
  return { id: r.id, url };
}

// Raw SQL conditions on the `media` table (strpos: plain substring test, no LIKE wildcards in file names)
const contains = (col: string) => Prisma.raw(`strpos(${col}, media.url) > 0`);
/** File is shown somewhere other than a product gallery: logo/homepage/settings, pages, category or brand images, product descriptions */
export const usedOnSiteSql = Prisma.sql`(
  EXISTS (SELECT 1 FROM categories c WHERE c.image = media.url)
  OR EXISTS (SELECT 1 FROM brands b WHERE b.image = media.url)
  OR EXISTS (SELECT 1 FROM pages pg WHERE ${contains("pg.content")})
  OR EXISTS (SELECT 1 FROM settings st WHERE ${contains("st.value::text")})
  OR EXISTS (SELECT 1 FROM products p WHERE ${contains("COALESCE(p.description, '')")} OR ${contains("COALESCE(p.short_description, '')")} OR ${contains("COALESCE(p.specification, '')")}))`;
export const unusedSql = Prisma.sql`NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.media_id = media.id)
  AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.image_id = media.id) AND NOT ${usedOnSiteSql}`;

/** Media library search + "unused" filter (shared by the page and its select-all-matching bulk action), for `FROM media` */
export function mediaWhere(q?: string, unused = false) {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (q) { const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`; parts.push(Prisma.sql`(media.title ILIKE ${like} OR media.url ILIKE ${like})`); }
  if (unused) parts.push(unusedSql);
  return Prisma.join(parts, " AND ");
}

/** Ids of media matching a mediaWhere() condition */
export async function mediaIdsWhere(where: Prisma.Sql) {
  return (await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM media WHERE ${where}`).map((r) => r.id);
}

/** Bulk delete; files still used on the site (outside product galleries) are skipped */
export async function deleteMediaMany(ids: number[]) {
  if (!ids.length) return { deleted: 0, skipped: 0 };
  const inUse = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM media WHERE id IN (${Prisma.join(ids)}) AND ${usedOnSiteSql}`;
  const skip = new Set(inUse.map((r) => r.id));
  for (const id of ids) if (!skip.has(id)) await deleteMedia(id);
  return { deleted: ids.length - skip.size, skipped: skip.size };
}

export async function deleteMedia(id: number) {
  const m = await prisma.media.findUnique({ where: { id } });
  if (!m) return;
  // gallery rows go with it (ON DELETE CASCADE); products using it as main image get none (SET NULL)
  await prisma.media.delete({ where: { id } });
  const file = path.resolve(ROOT, m.url.replace(/^\/uploads\//, ""));
  if (file.startsWith(ROOT + path.sep)) await unlink(file).catch(() => {});
}
