import "server-only";
import path from "path";
import { lookup } from "dns/promises";
import { db, schema as s } from "@/db";
import { and, asc, eq, like, ne } from "drizzle-orm";
import { slugify } from "../format";
import { saveUpload } from "./media";
import { parseBundleSpec, formatBundleSpec, resolveBundleItems, setBundleItems, refreshBundleStock } from "../bundles";

/** Columns of our own export / template. */
export const COLUMNS = [
  "id", "sku", "name", "slug", "status", "regular_price", "sale_price", "sale_from", "sale_to",
  "manage_stock", "stock_qty", "stock_status", "low_stock_amount", "weight", "featured", "badge_text",
  "categories", "brands", "tags", "images", "bundle_items", "short_description", "description", "seo_title", "seo_description",
] as const;
type Col = (typeof COLUMNS)[number];

const ALIASES: Record<string, Col> = {
  title: "name", product_name: "name", product: "name", price: "regular_price", published: "status",
  stock: "stock_qty", quantity: "stock_qty", qty: "stock_qty", in_stock: "stock_status", is_featured: "featured",
  weight_kg: "weight",
  category: "categories", brand: "brands", tag: "tags", image: "images", image_url: "images", image_urls: "images",
};
const MAX_ROWS = 5000;
/** A cell containing only this clears the field when updating */
const CLEAR = "-";

export async function uniqueSlug(base: string, exceptId?: number) {
  let slug = slugify(base) || "product"; let n = 2;
  while (await db.query.products.findFirst({ where: exceptId ? and(eq(s.products.slug, slug), ne(s.products.id, exceptId)) : eq(s.products.slug, slug) })) slug = `${slugify(base)}-${n++}`;
  return slug;
}

/* ---------------- CSV ---------------- */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const nl = text.indexOf("\n"); const head = nl === -1 ? text : text.slice(0, nl);
  const delim = [",", ";", "\t"].sort((a, b) => head.split(b).length - head.split(a).length)[0]; // Excel uses ";" in some locales
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const blank = (r: string[]) => r.every((c) => c.trim() === "");
const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
/** BOM so Excel opens the file as UTF-8 */
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");

/* ---------------- export ---------------- */
export async function exportProductsCsv() {
  const [prods, cats, pc, brs, pb, tgs, pt, imgs] = await Promise.all([
    db.select().from(s.products).where(ne(s.products.status, "trash")).orderBy(asc(s.products.id)),
    db.select().from(s.categories), db.select().from(s.productCategories),
    db.select().from(s.brands), db.select().from(s.productBrands),
    db.select().from(s.tags), db.select().from(s.productTags),
    db.select({ productId: s.productImages.productId, url: s.media.url, position: s.productImages.position }).from(s.productImages)
      .innerJoin(s.media, eq(s.media.id, s.productImages.mediaId)).orderBy(asc(s.productImages.position)),
  ]);
  const bundleRows = await db.select({ bundleId: s.productBundleItems.bundleId, productId: s.productBundleItems.productId, qty: s.productBundleItems.qty, sku: s.products.sku })
    .from(s.productBundleItems).leftJoin(s.products, eq(s.products.id, s.productBundleItems.productId)).orderBy(asc(s.productBundleItems.position));
  const pbundle = new Map<number, { sku: string; productId: number; qty: number }[]>();
  for (const b of bundleRows) pbundle.set(b.bundleId, [...(pbundle.get(b.bundleId) ?? []), { sku: b.sku ?? "", productId: b.productId, qty: b.qty }]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const catPath = (id: number) => { const parts: string[] = []; let c = catById.get(id); while (c) { parts.unshift(c.name); c = c.parentId ? catById.get(c.parentId) : undefined; } return parts.join(" > "); };
  const group = <T extends { productId: number }>(rows: T[], f: (r: T) => string) => {
    const m = new Map<number, string[]>(); for (const r of rows) { const v = f(r); if (v) m.set(r.productId, [...(m.get(r.productId) ?? []), v]); } return m;
  };
  const brandName = new Map(brs.map((b) => [b.id, b.name])), tagName = new Map(tgs.map((t) => [t.id, t.name]));
  const pcats = group(pc, (r) => catPath(r.categoryId)), pbrands = group(pb, (r) => brandName.get(r.brandId) ?? ""), ptags = group(pt, (r) => tagName.get(r.tagId) ?? "");
  const base = process.env.SITE_URL || "";
  const pimgs = group(imgs, (r) => base + r.url);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return toCsv([
    [...COLUMNS],
    ...prods.map((p) => {
      const c = pcats.get(p.id) ?? []; const primary = p.primaryCategoryId ? catPath(p.primaryCategoryId) : "";
      return [
        p.id, p.sku ?? "", p.name, p.slug, p.status, p.regularPrice, p.salePrice ?? "", day(p.saleFrom), day(p.saleTo),
        p.manageStock ? 1 : 0, p.stockQty ?? "", p.stockStatus, p.lowStockAmount ?? "", p.weight, p.featured ? 1 : 0, p.badgeText,
        (primary && c.includes(primary) ? [primary, ...c.filter((x) => x !== primary)] : c).join(" | "),
        (pbrands.get(p.id) ?? []).join(" | "), (ptags.get(p.id) ?? []).join(" | "), (pimgs.get(p.id) ?? []).join(" | "),
        p.type === "bundle" ? formatBundleSpec(pbundle.get(p.id) ?? []) : "",
        p.shortDescription ?? "", p.description ?? "", p.seoTitle, p.seoDescription ?? "",
      ];
    }),
  ]);
}

export function templateCsv() {
  return toCsv([
    [...COLUMNS],
    ["", "SAM-A15-128", "Samsung Galaxy A15 128GB", "", "published", "199.00", "179.00", "", "", "1", "12", "", "2", "0.4", "0", "New",
      "Phones > Smartphones", "Samsung", "android | 4g", "https://example.com/a15-front.jpg | https://example.com/a15-back.jpg", "",
      "<p>6.5\" display, 128GB storage.</p>", "<p>Full description here.</p>", "", ""],
  ]);
}

/* ---------------- import ---------------- */
export type ImportRow = { line: number; action: "create" | "update" | "skip" | "error"; name: string; notes: string[] };
export type ImportReport = { dryRun: boolean; rows: ImportRow[]; created: number; updated: number; skipped: number; errors: number; imageErrors: number; ignoredColumns: string[] };

type Term = { id: number; name: string; slug: string; parentId?: number | null };
const normHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const list = (v: string) => v.split(v.includes("|") ? "|" : ",").map((x) => x.trim()).filter(Boolean);
/** Image cells: "|" separated, or comma/newline separated only where the next item starts a new link
 *  (so links that contain commas, e.g. Cloudinary "w_500,h_500", stay whole) */
const listImages = (v: string) => (v.includes("|") ? v.split("|")
  : /https?:\/\/|\//.test(v) ? v.split(/\s*[,\n]\s*(?=https?:\/\/|\/)/) : v.split(","))
  .map((x) => x.trim()).filter(Boolean);

/* ---------------- image download ---------------- */
type ImageResult = { id: number } | { checked: string } | { error: string };
const IMAGE_CONCURRENCY = 6;
// many shops/CDNs refuse requests that don't look like a browser
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif" };
class PermanentError extends Error {}

/** Share links open a web page; turn them into the direct file link */
function directLink(u: URL) {
  const driveId = u.hostname === "drive.google.com" ? (u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id")) : null;
  if (driveId) return new URL(`https://drive.google.com/uc?export=download&id=${driveId}`);
  if (/(^|\.)dropbox\.com$/.test(u.hostname)) { const d = new URL(u); d.searchParams.delete("dl"); d.searchParams.set("raw", "1"); return d; }
  return u;
}

/** Real format from the first bytes; servers often send "application/octet-stream" or the wrong type */
function sniff(b: Uint8Array): { type?: string; problem?: string } {
  const at = (o: number, t: string) => [...t].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg" };
  if (at(0, "\x89PNG")) return { type: "image/png" };
  if (at(0, "GIF8")) return { type: "image/gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { type: "image/webp" };
  if (at(4, "ftypavif") || at(4, "ftypavis")) return { type: "image/avif" };
  if (at(4, "ftypheic") || at(4, "ftypheix") || at(4, "ftypmif1")) return { problem: "it's a HEIC (iPhone) photo; convert it to JPG first" };
  if (at(0, "BM") || at(0, "II*\0") || at(0, "MM\0*")) return { problem: "BMP/TIFF images aren't supported; convert it to JPG first" };
  if (/^\s*<(\?xml[^>]*>\s*)?svg/i.test(new TextDecoder().decode(b.slice(0, 200)))) return { problem: "SVG images aren't allowed" };
  if (/^\s*</.test(new TextDecoder().decode(b.slice(0, 50)))) return { problem: "the link opens a web page, not the image itself (open the image, right-click it and choose “Copy image address”)" };
  return { problem: "the file isn't a JPG, PNG, WebP, GIF or AVIF image" };
}

function describe(e: any) {
  if (e?.name === "TimeoutError") return "the website took too long to respond";
  const code = e?.cause?.code as string | undefined;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "the website address couldn't be found";
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "the website closed the connection";
  if (code?.includes("CERT") || code?.includes("SSL")) return "the website's security certificate is invalid";
  return e?.message || String(e);
}

/** Download with browser headers, up to 3 attempts for temporary failures */
const PRIVATE_IP = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1?$|f[cd]|fe[89ab]|::ffff:(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i;
/** Fetches only public web addresses (also after redirects), so an import file can't reach the server's own network */
async function fetchPublic(start: URL, init: RequestInit) {
  let u = start;
  for (let hop = 0; hop < 5; hop++) {
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new PermanentError("only http and https links are allowed");
    const addrs = await lookup(u.hostname.replace(/^\[|\]$/g, ""), { all: true });
    if (addrs.some((a) => PRIVATE_IP.test(a.address))) throw new PermanentError("that address isn't a public website");
    const res = await fetch(u, { ...init, redirect: "manual" });
    const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!to) return res;
    u = new URL(to, u);
  }
  throw new PermanentError("too many redirects");
}

export async function downloadImage(link: URL) {
  const u = directLink(link);
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchPublic(u, { headers: { ...BROWSER_HEADERS, Referer: link.origin + "/" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const msg = res.status === 404 || res.status === 410 ? `image not found (HTTP ${res.status})` : res.status === 401 || res.status === 403 ? `the website refused the download (HTTP ${res.status}); it may block other sites from using its images` : `HTTP ${res.status}`;
        if (res.status !== 408 && res.status !== 429 && res.status < 500) throw new PermanentError(msg);
        throw new Error(msg);
      }
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.length > 15 * 1024 * 1024) throw new PermanentError("the image is larger than 15 MB");
      const { type, problem } = sniff(data);
      if (!type) throw new PermanentError(problem!);
      const base = path.basename(decodeURIComponent(u.pathname)).replace(/\.[a-z0-9]{1,5}$/i, "") || "image";
      return { data, type, name: `${base}.${EXT[type]}` }; // extension from the real format, not the link (.php, .jfif…)
    } catch (e) {
      if (e instanceof PermanentError) throw e;
      last = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error(describe(last));
}
const bool = (v: string) => (/^(1|yes|y|true)$/i.test(v) ? true : /^(0|no|n|false)$/i.test(v) ? false : null);

export async function importProducts(text: string, dryRun: boolean): Promise<ImportReport> {
  const all = parseCsv(text);
  while (all.length && blank(all[0])) all.shift();
  const dataRows = all.slice(1).filter((r) => !blank(r)).length;
  if (!dataRows) throw new Error("The file has no product rows. The first row must be the column headings.");
  if (dataRows > MAX_ROWS) throw new Error(`The file has ${dataRows} rows. Please split it into files of at most ${MAX_ROWS} products.`);
  const headers = all[0].map(normHeader);
  // exports from other systems have their own IDs, which could match the wrong products here
  if (headers.includes("type")) throw new Error("This file has a “type” column, so it wasn't exported from this store. Use Export all products or the template instead.");
  const colIndex = new Map<Col, number>(); const ignoredColumns: string[] = [];
  headers.forEach((h, i) => {
    const c = (COLUMNS as readonly string[]).includes(h) ? (h as Col) : ALIASES[h];
    if (c && !colIndex.has(c)) colIndex.set(c, i); else ignoredColumns.push(all[0][i].trim());
  });
  if (!colIndex.has("name") && !colIndex.has("sku") && !colIndex.has("id") && !colIndex.has("slug"))
    throw new Error("Couldn't find a name, sku, id or slug column. Download the template to see the expected headings.");

  const [cats, brands, tags] = await Promise.all([
    db.select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug, parentId: s.categories.parentId }).from(s.categories),
    db.select({ id: s.brands.id, name: s.brands.name, slug: s.brands.slug }).from(s.brands),
    db.select({ id: s.tags.id, name: s.tags.name, slug: s.tags.slug }).from(s.tags),
  ]);
  let fakeId = -1; // stands in for terms that a dry run would create
  const imageCache = new Map<string, Promise<ImageResult>>();
  const seenInFile = new Map<string, number>(); // sku/slug -> product id created earlier in this file (dry run: fake id)
  const report: ImportReport = { dryRun, rows: [], created: 0, updated: 0, skipped: 0, errors: 0, imageErrors: 0, ignoredColumns };

  async function uniqueTermSlug(table: typeof s.categories | typeof s.brands | typeof s.tags, existing: Term[], name: string) {
    let slug = slugify(name) || "item"; let n = 2;
    while (existing.some((t) => t.slug === slug) || (await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1)).length) slug = `${slugify(name)}-${n++}`;
    return slug;
  }
  async function resolveCategory(pathStr: string, notes: string[]) {
    let parentId: number | null = null;
    for (const name of pathStr.split(">").map((x) => x.trim()).filter(Boolean)) {
      let c = cats.find((x) => (x.parentId ?? null) === parentId && x.name.toLowerCase() === name.toLowerCase());
      if (!c) {
        if (dryRun) c = { id: fakeId--, name, slug: "", parentId };
        else { const slug = await uniqueTermSlug(s.categories, cats, name); const [r] = await db.insert(s.categories).values({ name, slug, parentId }).$returningId(); c = { id: r.id, name, slug, parentId }; }
        cats.push(c); notes.push(`New category “${name}”`);
      }
      parentId = c.id;
    }
    return parentId;
  }
  async function resolveTerm(kind: "brand" | "tag", name: string, notes: string[]) {
    const pool = kind === "brand" ? brands : tags; const table = kind === "brand" ? s.brands : s.tags;
    let t = pool.find((x) => x.name.toLowerCase() === name.toLowerCase() || x.slug === slugify(name));
    if (!t) {
      if (dryRun) t = { id: fakeId--, name, slug: slugify(name) };
      else { const slug = await uniqueTermSlug(table, pool, name); const [r] = await db.insert(table).values({ name, slug }).$returningId(); t = { id: r.id, name, slug }; }
      pool.push(t); notes.push(`New ${kind} “${name}”`);
    }
    return t.id;
  }
  /** One promise per distinct image value, so a link used on many rows is fetched once */
  function resolveImage(v: string, alt: string) {
    let p = imageCache.get(v);
    if (!p) { p = lookupOrDownload(v, alt); imageCache.set(v, p); }
    return p;
  }
  async function lookupOrDownload(v: string, alt: string): Promise<ImageResult> {
    let local = v; let remote: URL | null = null;
    try { const u = new URL(v); if (u.protocol === "http:" || u.protocol === "https:") { remote = u; local = decodeURIComponent(u.pathname); } } catch {}
    let m = local.startsWith("/uploads/") ? await db.query.media.findFirst({ where: eq(s.media.url, local) }) : undefined;
    if (!m && !local.includes("/")) m = await db.query.media.findFirst({ where: like(s.media.url, `%/${local}`) });
    if (m) return { id: m.id };
    if (!remote) return { error: `Image “${v}” not found in the media library` };
    try {
      const img = await downloadImage(remote);
      if (dryRun) return { checked: img.name };
      const { id } = await saveUpload(new File([img.data], img.name, { type: img.type }), alt);
      return { id };
    } catch (e: any) { return { error: `Couldn't download image ${v}: ${e.message}` }; }
  }
  const imageValues = (v: string) => (v === CLEAR ? [] : listImages(v));

  // download every image up front, several at a time (much faster than one by one)
  const imgCol = colIndex.get("images"), nameCol = colIndex.get("name");
  if (imgCol !== undefined) {
    const jobs: [string, string][] = [];
    for (const r of all.slice(1)) for (const v of imageValues((r[imgCol] ?? "").trim())) if (!jobs.some((j) => j[0] === v)) jobs.push([v, nameCol !== undefined ? (r[nameCol] ?? "").trim() : ""]);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, jobs.length) }, async () => {
      while (next < jobs.length) { const [v, alt] = jobs[next++]; await resolveImage(v, alt); }
    }));
  }

  const touched: number[] = []; // products written: bundles containing them get their stock status refreshed
  for (let li = 1; li < all.length; li++) {
    const cells = all[li]; if (blank(cells)) continue;
    const notes: string[] = [];
    const raw = (c: Col) => { const i = colIndex.get(c); return i === undefined ? undefined : (cells[i] ?? "").trim(); };
    const get = (c: Col) => { const v = raw(c); return v === "" ? undefined : v; };
    const label = get("name") || get("sku") || get("slug") || `row ${li + 1}`;
    const push = (action: ImportRow["action"], name = label) => {
      report.rows.push({ line: li + 1, action, name, notes });
      report[action === "create" ? "created" : action === "update" ? "updated" : action === "skip" ? "skipped" : "errors"]++;
    };
    try {
      // find the existing product: sku, then id, then slug
      const sku = get("sku"); const idv = get("id"); const slugv = get("slug");
      let existing: typeof s.products.$inferSelect | undefined; let earlierId: number | undefined;
      if (sku) { existing = await db.query.products.findFirst({ where: eq(s.products.sku, sku) }); earlierId ??= seenInFile.get("sku:" + sku); }
      if (!existing && idv && /^\d+$/.test(idv)) existing = await db.query.products.findFirst({ where: eq(s.products.id, Number(idv)) });
      if (!existing && slugv) { existing = await db.query.products.findFirst({ where: eq(s.products.slug, slugify(slugv)) }); earlierId ??= seenInFile.get("slug:" + slugify(slugv)); }
      const isUpdate = !!existing || earlierId !== undefined;
      if (!isUpdate && !get("name")) { notes.push("Name is required for a new product (no existing product matched this row's SKU / ID / slug)."); push("error"); continue; }

      const errs: string[] = [];
      const patch: Partial<typeof s.products.$inferInsert> = {};
      const trashed = existing?.status === "trash";
      if (trashed) notes.push(get("status") ? "Was in the trash; restored by the status column." : "This product is in the trash. It was updated but stays in the trash (add a status column to restore it).");
      const money = (c: Col) => {
        const v = get(c); if (v === undefined) return undefined; if (v === CLEAR) return null;
        const n = Number(v.replace(/[$,\s]|USD/gi, "")); if (isNaN(n) || n < 0) { errs.push(`${c}: “${v}” is not a valid price`); return undefined; }
        return n.toFixed(2);
      };
      const int = (c: Col) => {
        const v = get(c); if (v === undefined) return undefined; if (v === CLEAR) return null;
        const n = Number(v); if (!Number.isInteger(n)) { errs.push(`${c}: “${v}” is not a whole number`); return undefined; }
        return n;
      };
      const date = (c: Col, endOfDay = false) => {
        const v = get(c); if (v === undefined) return undefined; if (v === CLEAR) return null;
        const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + (endOfDay ? "T23:59:59" : "T00:00:00") : v);
        if (isNaN(d.getTime())) { errs.push(`${c}: “${v}” is not a date (use YYYY-MM-DD)`); return undefined; }
        return d;
      };
      const text = (c: Col, fallback: string | null = "") => { const v = get(c); return v === undefined ? undefined : v === CLEAR ? fallback : v; };

      if (get("name")) patch.name = get("name")!;
      if (sku && existing && existing.sku !== sku) {
        const clash = await db.query.products.findFirst({ where: and(eq(s.products.sku, sku), ne(s.products.id, existing.id)) });
        if (clash) errs.push(`SKU ${sku} is already used by “${clash.name}”${clash.status === "trash" ? " (in the trash)" : ""}`); else patch.sku = sku;
      } else if (sku && !isUpdate) patch.sku = sku;

      const st = get("status");
      if (st) {
        const v = st.toLowerCase();
        if (["published", "publish", "1"].includes(v)) patch.status = "published";
        else if (["draft", "0", "-1", "private"].includes(v)) patch.status = "draft";
        else errs.push(`status: “${st}” should be published or draft`);
        if (trashed && patch.status) { patch.trashedAt = null; patch.statusBeforeTrash = null; }
      }
      const reg = money("regular_price"); if (reg !== undefined) patch.regularPrice = reg ?? "0";
      const sale = money("sale_price"); if (sale !== undefined) patch.salePrice = sale;
      const from = date("sale_from"); if (from !== undefined) patch.saleFrom = from;
      const to = date("sale_to", true); if (to !== undefined) patch.saleTo = to;
      const regFinal = Number(patch.regularPrice ?? existing?.regularPrice ?? 0), saleFinal = patch.salePrice !== undefined ? patch.salePrice : existing?.salePrice;
      if (saleFinal !== null && saleFinal !== undefined && Number(saleFinal) >= regFinal) notes.push("Sale price isn't lower than the regular price, so it won't show as a sale.");

      // stock
      const ms = get("manage_stock"); const qty = int("stock_qty"); const ss = get("stock_status");
      if (ms !== undefined) { const b = bool(ms); if (b === null) errs.push(`manage_stock: “${ms}” should be 1 or 0`); else patch.manageStock = b; }
      if (qty !== undefined) { patch.stockQty = qty; if (ms === undefined) patch.manageStock = qty !== null; }
      if (ss) {
        const v = ss.toLowerCase().replace(/[\s_-]/g, "");
        const m = ({ instock: "instock", "1": "instock", yes: "instock", outofstock: "outofstock", "0": "outofstock", no: "outofstock", onbackorder: "onbackorder", backorder: "onbackorder" } as const)[v];
        if (m) patch.stockStatus = m; else errs.push(`stock_status: “${ss}” should be instock, outofstock or onbackorder`);
      }
      const manage = patch.manageStock ?? existing?.manageStock ?? false;
      const finalQty = patch.stockQty !== undefined ? patch.stockQty : existing?.stockQty ?? null;
      const finalStatus = patch.stockStatus ?? existing?.stockStatus ?? "instock";
      if (!manage && patch.manageStock === false) patch.stockQty = null;
      if (manage && finalStatus !== "onbackorder" && (ms !== undefined || qty !== undefined || ss)) patch.stockStatus = (finalQty ?? 0) > 0 ? "instock" : "outofstock";

      const low = int("low_stock_amount"); if (low !== undefined) patch.lowStockAmount = low;
      const w = text("weight"); if (w !== undefined) patch.weight = w ?? "";
      const ft = get("featured"); if (ft !== undefined) { const b = bool(ft); if (b === null) errs.push(`featured: “${ft}” should be 1 or 0`); else patch.featured = b; }
      const badge = text("badge_text"); if (badge !== undefined) patch.badgeText = badge ?? "";
      const sd = text("short_description"); if (sd !== undefined) patch.shortDescription = sd?.replace(/\\n/g, "\n") ?? "";
      const de = text("description"); if (de !== undefined) patch.description = de?.replace(/\\n/g, "\n") ?? "";
      const seoT = text("seo_title"); if (seoT !== undefined) patch.seoTitle = seoT ?? "";
      const seoD = text("seo_description"); if (seoD !== undefined) patch.seoDescription = seoD ?? "";

      // bundles: "SKU*2 | SKU*1"; "-" turns a bundle back into a single product
      const bcell = get("bundle_items");
      let bundleSpec: { productId?: number; sku?: string; qty: number }[] | null | undefined; // undefined = unchanged, null = not a bundle
      if (bcell !== undefined) {
        if (bcell === CLEAR) { bundleSpec = null; patch.type = "simple"; }
        else {
          const spec = parseBundleSpec(bcell);
          // products created earlier in this file don't exist yet during a check: accept them
          const pending = dryRun ? spec.filter((i) => i.sku && seenInFile.has("sku:" + i.sku)) : [];
          const r = await resolveBundleItems(existing?.id ?? null, spec.filter((i) => !pending.includes(i)));
          const errors = pending.length && r.errors.length === 1 && r.errors[0].startsWith("A bundle needs") ? [] : r.errors;
          if (errors.length) errs.push(...errors.map((e) => `bundle_items: ${e}`));
          else {
            bundleSpec = spec; patch.type = "bundle"; patch.manageStock = false; patch.stockQty = null;
            if (ms !== undefined || qty !== undefined || ss) notes.push("Stock columns are ignored for bundles: their stock comes from the products in them.");
            notes.push(`Bundle of ${spec.length} product(s)`);
          }
        }
      }

      if (errs.length) { notes.push(...errs); push("error"); continue; }

      if (!isUpdate) {
        if (patch.regularPrice === undefined || Number(patch.regularPrice) === 0) { patch.status = "draft"; notes.push("No regular price, so it was saved as a draft."); }
        patch.slug = dryRun ? slugify(slugv || patch.name!) : await uniqueSlug(slugv || patch.name!);
      } else if (slugv && slugv !== CLEAR && existing && slugify(slugv) !== existing.slug) patch.slug = await uniqueSlug(slugv, existing.id);

      // relations: undefined = leave as is, [] = clear
      const productName = patch.name ?? existing?.name ?? label;
      const terms = async (c: Col, resolve: (v: string) => Promise<number | null>) => {
        const v = get(c); if (v === undefined) return undefined; if (v === CLEAR) return [];
        const out: number[] = []; for (const x of list(v)) { const id = await resolve(x); if (id !== null && !out.includes(id)) out.push(id); } return out;
      };
      const catIds = await terms("categories", (v) => resolveCategory(v, notes));
      const brandIds = await terms("brands", (v) => resolveTerm("brand", v, notes));
      const tagIds = await terms("tags", (v) => resolveTerm("tag", v, notes));
      let imageIds: number[] | undefined;
      const imgCell = get("images");
      if (imgCell !== undefined) {
        imageIds = [];
        for (const v of imageValues(imgCell)) {
          const r = await resolveImage(v, productName);
          if ("error" in r) { notes.push(r.error); report.imageErrors++; }
          else if ("checked" in r) { notes.push(`Will download ${r.checked}`); imageIds.push(fakeId--); }
          else if (!imageIds.includes(r.id)) imageIds.push(r.id);
        }
      }
      if (imageIds && !imageIds.length && get("images") !== CLEAR) imageIds = undefined; // every image failed: keep the current ones
      if (catIds) patch.primaryCategoryId = catIds[0] ?? null;
      if (imageIds) patch.imageId = imageIds[0] ?? null;

      if (dryRun) {
        if (!isUpdate) { const fake = fakeId--; if (sku) seenInFile.set("sku:" + sku, fake); if (patch.slug) seenInFile.set("slug:" + patch.slug, fake); }
        push(isUpdate ? "update" : "create", productName); continue;
      }
      const pid = await db.transaction(async (tx) => {
        let id = existing?.id;
        if (id) { if (Object.keys(patch).length) await tx.update(s.products).set(patch).where(eq(s.products.id, id)); }
        else { const [r] = await tx.insert(s.products).values(patch as typeof s.products.$inferInsert).$returningId(); id = r.id; }
        if (catIds) { await tx.delete(s.productCategories).where(eq(s.productCategories.productId, id)); if (catIds.length) await tx.insert(s.productCategories).values(catIds.map((c) => ({ productId: id!, categoryId: c }))); }
        if (brandIds) { await tx.delete(s.productBrands).where(eq(s.productBrands.productId, id)); if (brandIds.length) await tx.insert(s.productBrands).values(brandIds.map((b) => ({ productId: id!, brandId: b }))); }
        if (tagIds) { await tx.delete(s.productTags).where(eq(s.productTags.productId, id)); if (tagIds.length) await tx.insert(s.productTags).values(tagIds.map((t) => ({ productId: id!, tagId: t }))); }
        if (imageIds) { await tx.delete(s.productImages).where(eq(s.productImages.productId, id)); if (imageIds.length) await tx.insert(s.productImages).values(imageIds.map((m, i) => ({ productId: id!, mediaId: m, position: i }))); }
        return id;
      });
      if (!existing) { const created = await db.query.products.findFirst({ where: eq(s.products.id, pid) }); if (created?.sku) seenInFile.set("sku:" + created.sku, pid); if (created) seenInFile.set("slug:" + created.slug, pid); }
      if (bundleSpec === null) await db.delete(s.productBundleItems).where(eq(s.productBundleItems.bundleId, pid!));
      else if (bundleSpec) { const errors = await setBundleItems(pid!, bundleSpec); if (errors.length) notes.push(...errors.map((e) => `bundle_items: ${e}`)); }
      touched.push(pid!);
      push(existing ? "update" : "create", productName);
    } catch (e: any) { notes.push(e.message || String(e)); push("error"); }
  }
  if (!dryRun) await refreshBundleStock(touched);
  return report;
}
