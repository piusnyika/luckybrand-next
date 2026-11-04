import { cache } from "react";
import { prisma, Prisma } from "@/lib/prisma";
import type { Category as CategoryRow } from "@prisma/client";
import type { StockStatus } from "@/lib/db-types";

export type Category = CategoryRow & { children?: Category[]; count?: number };

export type ProductCard = {
  id: number; name: string; slug: string; sku: string | null;
  price: number; regularPrice: number; salePrice: number | null; onSale: boolean;
  image: string | null; imageAlt: string; stockStatus: StockStatus; badgeText: string; isBundle?: boolean;
  /** approved reviews: average stars and how many (only when it has any) */
  rating?: { avg: number; count: number };
};

/** Price actually charged right now (sale price respects its schedule) */
export function effectivePrice(p: { regularPrice: string | number; salePrice: string | number | null; saleFrom?: Date | null; saleTo?: Date | null }) {
  const reg = Number(p.regularPrice);
  const sale = p.salePrice === null || p.salePrice === undefined || p.salePrice === "" ? null : Number(p.salePrice);
  const now = Date.now();
  const active = sale !== null && sale < reg && (!p.saleFrom || p.saleFrom.getTime() <= now) && (!p.saleTo || p.saleTo.getTime() >= now);
  return { price: active ? sale! : reg, regularPrice: reg, salePrice: active ? sale : null, onSale: active };
}

/** Price charged right now, for `products p` in raw SQL */
const priceExpr = Prisma.sql`(CASE WHEN p.sale_price IS NOT NULL AND p.sale_price < p.regular_price
  AND (p.sale_from IS NULL OR p.sale_from <= NOW()) AND (p.sale_to IS NULL OR p.sale_to >= NOW())
  THEN p.sale_price ELSE p.regular_price END)`;

/** Columns for a product card, from `products p LEFT JOIN media m` */
const cardColumns = Prisma.sql`p.id, p.name, p.slug, p.sku, p.regular_price::text AS "regularPrice", p.sale_price::text AS "salePrice",
  p.sale_from AS "saleFrom", p.sale_to AS "saleTo", p.stock_status AS "stockStatus", p.badge_text AS "badgeText", p.type,
  m.url AS image, m.alt AS "imageAlt",
  (SELECT ROUND(AVG(r.rating), 1)::float FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS "ratingAvg",
  (SELECT COUNT(*)::int FROM reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS "ratingCount"`;
type CardRow = {
  id: number; name: string; slug: string; sku: string | null; regularPrice: string; salePrice: string | null;
  saleFrom: Date | null; saleTo: Date | null; stockStatus: StockStatus; badgeText: string; type: string; image: string | null; imageAlt: string | null;
  ratingAvg: number | null; ratingCount: number;
};
function toCard(r: CardRow): ProductCard {
  const p = effectivePrice(r);
  return { id: r.id, name: r.name, slug: r.slug, sku: r.sku, ...p, image: r.image ?? null, imageAlt: r.imageAlt || r.name, stockStatus: r.stockStatus, badgeText: r.badgeText, ...(r.type === "bundle" ? { isBundle: true } : {}),
    ...(r.ratingCount ? { rating: { avg: Number(r.ratingAvg), count: r.ratingCount } } : {}) };
}

/* ---------------- categories ---------------- */
export const getAllCategories = cache(async (): Promise<Category[]> => {
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const counts = await prisma.productCategory.groupBy({ by: ["categoryId"], where: { product: { status: "published" } }, _count: { _all: true } });
  const cm = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return rows.map((r) => ({ ...r, count: cm.get(r.id) ?? 0 }));
});

export const getCategoryTree = cache(async (): Promise<Category[]> => {
  const all = (await getAllCategories()).map((c) => ({ ...c, children: [] as Category[] }));
  const byId = new Map(all.map((c) => [c.id, c]));
  const roots: Category[] = [];
  for (const c of all) (c.parentId && byId.get(c.parentId) ? byId.get(c.parentId)!.children! : roots).push(c);
  return roots;
});

export async function descendantIds(ids: number[]): Promise<number[]> {
  const all = await getAllCategories();
  const out = new Set(ids);
  let changed = true;
  while (changed) { changed = false; for (const c of all) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); changed = true; } }
  return [...out];
}

export async function categoryPath(cat: { id: number; parentId: number | null }): Promise<Category[]> {
  const all = await getAllCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const chain: Category[] = []; let c: Category | undefined = byId.get(cat.id);
  while (c) { chain.unshift(c); c = c.parentId ? byId.get(c.parentId) : undefined; }
  return chain;
}
export async function categoryUrl(cat: { id: number; parentId: number | null }) {
  return "/product-category/" + (await categoryPath(cat)).map((c) => c.slug).join("/") + "/";
}
export async function categoryUrlMap(): Promise<Map<number, string>> {
  const all = await getAllCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const m = new Map<number, string>();
  for (const c of all) {
    const parts: string[] = []; let x: Category | undefined = c;
    while (x) { parts.unshift(x.slug); x = x.parentId ? byId.get(x.parentId) : undefined; }
    m.set(c.id, "/product-category/" + parts.join("/") + "/");
  }
  return m;
}

/* ---------------- product listing ---------------- */
export type ListParams = {
  categoryIds?: number[]; brandId?: number; tagId?: number; search?: string;
  sort?: "latest" | "price" | "price-desc" | "popularity" | "name" | "random" | "menu_order";
  page?: number; perPage?: number; inStock?: boolean; onSale?: boolean; featured?: boolean;
  minPrice?: number; maxPrice?: number; excludeIds?: number[]; includeDrafts?: boolean;
};

/** Condition (for `products p`): in these categories or any of their subcategories */
async function inCategories(categoryIds: number[]) {
  const ids = await descendantIds(categoryIds);
  return Prisma.sql`p.id IN (SELECT product_id FROM product_categories WHERE category_id IN (${Prisma.join(ids)}))`;
}

export async function listProducts(p: ListParams = {}) {
  const where: Prisma.Sql[] = [];
  where.push(p.includeDrafts ? Prisma.sql`p.status <> 'trash'` : Prisma.sql`p.status = 'published'`);
  if (p.categoryIds?.length) where.push(await inCategories(p.categoryIds));
  if (p.brandId) where.push(Prisma.sql`p.id IN (SELECT product_id FROM product_brands WHERE brand_id = ${p.brandId})`);
  if (p.tagId) where.push(Prisma.sql`p.id IN (SELECT product_id FROM product_tags WHERE tag_id = ${p.tagId})`);
  if (p.search) {
    const words = p.search.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) { const like = `%${likeEscape(w)}%`; where.push(Prisma.sql`(p.name ILIKE ${like} OR p.sku ILIKE ${like})`); }
  }
  if (p.inStock) where.push(Prisma.sql`p.stock_status <> 'outofstock'`);
  if (p.featured) where.push(Prisma.sql`p.featured = true`);
  if (p.onSale) where.push(Prisma.sql`${priceExpr} < p.regular_price`);
  if (p.minPrice !== undefined) where.push(Prisma.sql`${priceExpr} >= ${p.minPrice}`);
  if (p.maxPrice !== undefined) where.push(Prisma.sql`${priceExpr} <= ${p.maxPrice}`);
  if (p.excludeIds?.length) where.push(Prisma.sql`p.id NOT IN (${Prisma.join(p.excludeIds)})`);

  const order = {
    latest: Prisma.sql`p.created_at DESC, p.id DESC`,
    price: Prisma.sql`${priceExpr} ASC`, "price-desc": Prisma.sql`${priceExpr} DESC`,
    popularity: Prisma.sql`p.total_sales DESC, p.views DESC`,
    name: Prisma.sql`p.name ASC`, random: Prisma.sql`RANDOM()`, menu_order: Prisma.sql`p.name ASC`,
  }[p.sort ?? "latest"];

  const perPage = p.perPage ?? 20; const page = Math.max(1, p.page ?? 1);
  const cond = Prisma.join(where, " AND ");
  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw<CardRow[]>`SELECT ${cardColumns} FROM products p LEFT JOIN media m ON m.id = p.image_id
      WHERE ${cond} ORDER BY ${order} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM products p WHERE ${cond}`,
  ]);
  return { items: rows.map(toCard), total: Number(total), page, perPage, pages: Math.max(1, Math.ceil(Number(total) / perPage)) };
}

/** Escapes % and _ so a search word is matched literally by LIKE/ILIKE */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function priceRange(categoryIds?: number[]) {
  const where: Prisma.Sql[] = [Prisma.sql`p.status = 'published'`];
  if (categoryIds?.length) where.push(await inCategories(categoryIds));
  const [r] = await prisma.$queryRaw<{ min: string | null; max: string | null }[]>`SELECT MIN(${priceExpr})::text AS min, MAX(${priceExpr})::text AS max
    FROM products p WHERE ${Prisma.join(where, " AND ")}`;
  return { min: Math.floor(Number(r?.min ?? 0)), max: Math.ceil(Number(r?.max ?? 0)) };
}

export async function getCards(ids: number[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await prisma.$queryRaw<CardRow[]>`SELECT ${cardColumns} FROM products p LEFT JOIN media m ON m.id = p.image_id
    WHERE p.id IN (${Prisma.join(ids)}) AND p.status = 'published'`;
  const m = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((i) => m.get(i)).filter(Boolean) as ProductCard[];
}

/* ---------------- single product ---------------- */
export const getProductBySlug = cache(async (slug: string, includeDrafts = false) => {
  const p = await prisma.product.findFirst({ where: includeDrafts ? { slug } : { slug, status: "published" } });
  if (!p) return null;
  return { ...p, ...effectivePrice(p), ...(await productRelations(p.id, p.name)) };
});

/** Images, categories, brands and tags for one product */
export async function productRelations(id: number, name = "") {
  const [imgs, cats, brs, tgs] = await Promise.all([
    prisma.productImage.findMany({ where: { productId: id }, orderBy: { position: "asc" }, select: { media: { select: { id: true, url: true, alt: true, width: true, height: true } } } }),
    prisma.productCategory.findMany({ where: { productId: id }, select: { category: true } }),
    prisma.productBrand.findMany({ where: { productId: id }, select: { brand: true } }),
    prisma.productTag.findMany({ where: { productId: id }, select: { tag: true } }),
  ]);
  return {
    gallery: imgs.map(({ media: i }) => ({ ...i, alt: i.alt || name })),
    categoryList: cats.map((x) => x.category), brandList: brs.map((x) => x.brand), tagList: tgs.map((x) => x.tag),
  };
}

export async function relatedProducts(productId: number, categoryIds: number[], limit = 5) {
  if (!categoryIds.length) return [];
  const r = await listProducts({ categoryIds, excludeIds: [productId], sort: "random", perPage: limit, inStock: true });
  return r.items;
}

export async function searchSuggest(q: string, limit = 8) {
  if (q.trim().length < 2) return [];
  return (await listProducts({ search: q, perPage: limit, sort: "popularity" })).items;
}

/* ---------------- menus ---------------- */
export type MenuNode = { id: number; label: string; url: string; children: MenuNode[] };
export const getMenu = cache(async (menu: string): Promise<MenuNode[]> => {
  const rows = await prisma.menuItem.findMany({ where: { menu }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const nodes = new Map(rows.map((r) => [r.id, { id: r.id, label: r.label, url: r.url, children: [] as MenuNode[] }]));
  const roots: MenuNode[] = [];
  for (const r of rows) (r.parentId && nodes.get(r.parentId) ? nodes.get(r.parentId)!.children : roots).push(nodes.get(r.id)!);
  return roots;
});

export const getBrands = cache(async () => prisma.brand.findMany({ orderBy: { name: "asc" } }));
