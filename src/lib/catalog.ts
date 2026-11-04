import { cache } from "react";
import { db, schema as s } from "@/db";
import { and, asc, desc, eq, inArray, like, or, sql, gte, lte, ne, type SQL } from "drizzle-orm";

export type Category = typeof s.categories.$inferSelect & { children?: Category[]; count?: number };

export type ProductCard = {
  id: number; name: string; slug: string; sku: string | null;
  price: number; regularPrice: number; salePrice: number | null; onSale: boolean;
  image: string | null; imageAlt: string; stockStatus: "instock" | "outofstock" | "onbackorder"; badgeText: string; isBundle?: boolean;
};

/** Price actually charged right now (sale price respects its schedule) */
export function effectivePrice(p: { regularPrice: string | number; salePrice: string | number | null; saleFrom?: Date | null; saleTo?: Date | null }) {
  const reg = Number(p.regularPrice);
  const sale = p.salePrice === null || p.salePrice === undefined || p.salePrice === "" ? null : Number(p.salePrice);
  const now = Date.now();
  const active = sale !== null && sale < reg && (!p.saleFrom || p.saleFrom.getTime() <= now) && (!p.saleTo || p.saleTo.getTime() >= now);
  return { price: active ? sale! : reg, regularPrice: reg, salePrice: active ? sale : null, onSale: active };
}

const priceExpr = sql<number>`CASE WHEN ${s.products.salePrice} IS NOT NULL AND ${s.products.salePrice} < ${s.products.regularPrice}
  AND (${s.products.saleFrom} IS NULL OR ${s.products.saleFrom} <= NOW()) AND (${s.products.saleTo} IS NULL OR ${s.products.saleTo} >= NOW())
  THEN ${s.products.salePrice} ELSE ${s.products.regularPrice} END`;

const cardColumns = {
  id: s.products.id, name: s.products.name, slug: s.products.slug, sku: s.products.sku,
  regularPrice: s.products.regularPrice, salePrice: s.products.salePrice, saleFrom: s.products.saleFrom, saleTo: s.products.saleTo,
  stockStatus: s.products.stockStatus, badgeText: s.products.badgeText, type: s.products.type, image: s.media.url, imageAlt: s.media.alt,
};
function toCard(r: any): ProductCard {
  const p = effectivePrice(r);
  return { id: r.id, name: r.name, slug: r.slug, sku: r.sku, ...p, image: r.image ?? null, imageAlt: r.imageAlt || r.name, stockStatus: r.stockStatus, badgeText: r.badgeText, ...(r.type === "bundle" ? { isBundle: true } : {}) };
}

/* ---------------- categories ---------------- */
export const getAllCategories = cache(async (): Promise<Category[]> => {
  const rows = await db.select().from(s.categories).orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
  const counts = await db.select({ id: s.productCategories.categoryId, c: sql<number>`COUNT(*)` })
    .from(s.productCategories).innerJoin(s.products, eq(s.products.id, s.productCategories.productId))
    .where(eq(s.products.status, "published")).groupBy(s.productCategories.categoryId);
  const cm = new Map(counts.map((c) => [c.id, Number(c.c)]));
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

export async function listProducts(p: ListParams = {}) {
  const where: SQL[] = [];
  where.push(p.includeDrafts ? ne(s.products.status, "trash") : eq(s.products.status, "published"));
  if (p.categoryIds?.length) {
    const ids = await descendantIds(p.categoryIds);
    where.push(inArray(s.products.id, db.select({ id: s.productCategories.productId }).from(s.productCategories).where(inArray(s.productCategories.categoryId, ids))));
  }
  if (p.brandId) where.push(inArray(s.products.id, db.select({ id: s.productBrands.productId }).from(s.productBrands).where(eq(s.productBrands.brandId, p.brandId))));
  if (p.tagId) where.push(inArray(s.products.id, db.select({ id: s.productTags.productId }).from(s.productTags).where(eq(s.productTags.tagId, p.tagId))));
  if (p.search) {
    const words = p.search.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) where.push(or(like(s.products.name, `%${w}%`), like(s.products.sku, `%${w}%`))!);
  }
  if (p.inStock) where.push(ne(s.products.stockStatus, "outofstock"));
  if (p.featured) where.push(eq(s.products.featured, true));
  if (p.onSale) where.push(sql`${priceExpr} < ${s.products.regularPrice}`);
  if (p.minPrice !== undefined) where.push(gte(priceExpr, p.minPrice));
  if (p.maxPrice !== undefined) where.push(lte(priceExpr, p.maxPrice));
  if (p.excludeIds?.length) where.push(sql`${s.products.id} NOT IN (${sql.join(p.excludeIds.map((i) => sql`${i}`), sql`, `)})`);

  const order = {
    latest: [desc(s.products.createdAt), desc(s.products.id)],
    price: [asc(priceExpr)], "price-desc": [desc(priceExpr)],
    popularity: [desc(s.products.totalSales), desc(s.products.views)],
    name: [asc(s.products.name)], random: [sql`RAND()`], menu_order: [asc(s.products.name)],
  }[p.sort ?? "latest"];

  const perPage = p.perPage ?? 20; const page = Math.max(1, p.page ?? 1);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select(cardColumns).from(s.products).leftJoin(s.media, eq(s.media.id, s.products.imageId)).where(cond)
      .orderBy(...order).limit(perPage).offset((page - 1) * perPage),
    db.select({ total: sql<number>`COUNT(*)` }).from(s.products).where(cond),
  ]);
  return { items: rows.map(toCard), total: Number(total), page, perPage, pages: Math.max(1, Math.ceil(Number(total) / perPage)) };
}

export async function priceRange(categoryIds?: number[]) {
  const where: SQL[] = [eq(s.products.status, "published")];
  if (categoryIds?.length) {
    const ids = await descendantIds(categoryIds);
    where.push(inArray(s.products.id, db.select({ id: s.productCategories.productId }).from(s.productCategories).where(inArray(s.productCategories.categoryId, ids))));
  }
  const [r] = await db.select({ min: sql<number>`MIN(${priceExpr})`, max: sql<number>`MAX(${priceExpr})` }).from(s.products).where(and(...where));
  return { min: Math.floor(Number(r?.min ?? 0)), max: Math.ceil(Number(r?.max ?? 0)) };
}

export async function getCards(ids: number[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await db.select(cardColumns).from(s.products).leftJoin(s.media, eq(s.media.id, s.products.imageId))
    .where(and(inArray(s.products.id, ids), eq(s.products.status, "published")));
  const m = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((i) => m.get(i)).filter(Boolean) as ProductCard[];
}

/* ---------------- single product ---------------- */
export const getProductBySlug = cache(async (slug: string, includeDrafts = false) => {
  const p = await db.query.products.findFirst({
    where: includeDrafts ? eq(s.products.slug, slug) : and(eq(s.products.slug, slug), eq(s.products.status, "published")),
  });
  if (!p) return null;
  return { ...p, ...effectivePrice(p), ...(await productRelations(p.id, p.name)) };
});

/** Images, categories, brands and tags for one product (plain joins: works on MySQL and MariaDB) */
export async function productRelations(id: number, name = "") {
  const [imgs, cats, brs, tgs] = await Promise.all([
    db.select({ id: s.media.id, url: s.media.url, alt: s.media.alt, width: s.media.width, height: s.media.height })
      .from(s.productImages).innerJoin(s.media, eq(s.media.id, s.productImages.mediaId)).where(eq(s.productImages.productId, id)).orderBy(asc(s.productImages.position)),
    db.select({ c: s.categories }).from(s.productCategories).innerJoin(s.categories, eq(s.categories.id, s.productCategories.categoryId)).where(eq(s.productCategories.productId, id)),
    db.select({ b: s.brands }).from(s.productBrands).innerJoin(s.brands, eq(s.brands.id, s.productBrands.brandId)).where(eq(s.productBrands.productId, id)),
    db.select({ t: s.tags }).from(s.productTags).innerJoin(s.tags, eq(s.tags.id, s.productTags.tagId)).where(eq(s.productTags.productId, id)),
  ]);
  return {
    gallery: imgs.map((i) => ({ ...i, alt: i.alt || name })),
    categoryList: cats.map((x) => x.c), brandList: brs.map((x) => x.b), tagList: tgs.map((x) => x.t),
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
  const rows = await db.select().from(s.menuItems).where(eq(s.menuItems.menu, menu)).orderBy(asc(s.menuItems.position), asc(s.menuItems.id));
  const nodes = new Map(rows.map((r) => [r.id, { id: r.id, label: r.label, url: r.url, children: [] as MenuNode[] }]));
  const roots: MenuNode[] = [];
  for (const r of rows) (r.parentId && nodes.get(r.parentId) ? nodes.get(r.parentId)!.children : roots).push(nodes.get(r.id)!);
  return roots;
});

export const getBrands = cache(async () => db.select().from(s.brands).orderBy(asc(s.brands.name)));
