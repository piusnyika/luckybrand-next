"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq, ne, inArray } from "drizzle-orm";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { uniqueSlug } from "@/lib/admin/product-csv";
import { trashProducts, restoreProducts, deleteProductsForever } from "@/lib/admin/product-trash";
import { setBundleItems, refreshBundleStock } from "@/lib/bundles";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (v: string) => (v === "" || isNaN(Number(v)) ? null : String(Number(v)));
const ids = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter(Boolean);

export async function saveProduct(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id")) || null;
  const name = str(fd, "name");
  if (!name) redirect(`/admin/products/${id ?? "new"}/?msg=${encodeURIComponent("Error: product name is required")}`);
  const sku = str(fd, "sku") || null;
  if (sku) {
    const clash = await db.query.products.findFirst({ where: id ? and(eq(s.products.sku, sku), ne(s.products.id, id)) : eq(s.products.sku, sku) });
    if (clash) redirect(`/admin/products/${id ?? "new"}/?msg=${encodeURIComponent(`Error: SKU ${sku} is already used by “${clash.name}”${clash.status === "trash" ? " (in the trash)" : ""}`)}`);
  }
  const current = id ? await db.query.products.findFirst({ columns: { status: true }, where: eq(s.products.id, id) }) : null;
  const formStatus = (str(fd, "status") === "draft" ? "draft" : "published") as "draft" | "published";
  const type = str(fd, "type") === "bundle" ? "bundle" as const : "simple" as const;
  const bundleItems: { productId: number; qty: number }[] = type === "bundle" ? JSON.parse(str(fd, "bundleItems") || "[]") : [];
  if (type === "bundle" && !bundleItems.length) redirect(`/admin/products/${id ?? "new"}/?msg=${encodeURIComponent("Error: add at least one product to the bundle")}`);
  const manageStock = type === "simple" && fd.get("manageStock") === "on";
  const stockQty = manageStock ? Number(str(fd, "stockQty") || 0) : null;
  let stockStatus = str(fd, "stockStatus") as "instock" | "outofstock" | "onbackorder";
  if (manageStock && stockStatus !== "onbackorder") stockStatus = (stockQty ?? 0) > 0 ? "instock" : "outofstock";
  if (type === "bundle") stockStatus = "instock"; // the form has no stock field for bundles; refreshBundleStock sets the real status below
  const attributes = JSON.parse(str(fd, "attributes") || "[]").filter((a: { name: string; values: string[] }) => a.name && a.values.length);
  const imageIds: number[] = JSON.parse(str(fd, "images") || "[]");
  const categoryIds = ids(fd, "categories");
  const data = {
    name, slug: await uniqueSlug(str(fd, "slug") || name, id ?? undefined), sku, type,
    // editing a trashed product keeps it in the trash; the chosen status applies when it is restored
    ...(current?.status === "trash" ? { statusBeforeTrash: formStatus } : { status: formStatus }),
    shortDescription: str(fd, "shortDescription"), description: str(fd, "description"), specification: str(fd, "specification"),
    regularPrice: numOrNull(str(fd, "regularPrice")) ?? "0", salePrice: numOrNull(str(fd, "salePrice")),
    saleFrom: str(fd, "saleFrom") ? new Date(str(fd, "saleFrom")) : null, saleTo: str(fd, "saleTo") ? new Date(str(fd, "saleTo") + "T23:59:59") : null,
    manageStock, stockQty, stockStatus, lowStockAmount: str(fd, "lowStockAmount") ? Number(str(fd, "lowStockAmount")) : null,
    weight: str(fd, "weight"), featured: fd.get("featured") === "on", badgeText: str(fd, "badgeText"), videoUrl: str(fd, "videoUrl"),
    attributes: attributes.length ? attributes : null, seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription"), focusKeyword: str(fd, "focusKeyword"),
    primaryCategoryId: Number(fd.get("primaryCategoryId")) || categoryIds[0] || null, imageId: imageIds[0] ?? null,
  };
  let pid = id;
  if (pid) await db.update(s.products).set(data).where(eq(s.products.id, pid));
  else { const [r] = await db.insert(s.products).values(data).$returningId(); pid = r.id; }

  await db.delete(s.productCategories).where(eq(s.productCategories.productId, pid));
  if (categoryIds.length) await db.insert(s.productCategories).values(categoryIds.map((c) => ({ productId: pid!, categoryId: c })));
  await db.delete(s.productBrands).where(eq(s.productBrands.productId, pid));
  const brandIds = ids(fd, "brands"); if (brandIds.length) await db.insert(s.productBrands).values(brandIds.map((b) => ({ productId: pid!, brandId: b })));
  await db.delete(s.productTags).where(eq(s.productTags.productId, pid));
  const tagIds = [...ids(fd, "tags")];
  for (const t of str(fd, "newTags").split(",").map((x) => x.trim()).filter(Boolean)) {
    const slug = slugify(t); let tag = await db.query.tags.findFirst({ where: eq(s.tags.slug, slug) });
    if (!tag) { const [r] = await db.insert(s.tags).values({ name: t, slug }).$returningId(); tagIds.push(r.id); } else tagIds.push(tag.id);
  }
  if (tagIds.length) await db.insert(s.productTags).values([...new Set(tagIds)].map((t) => ({ productId: pid!, tagId: t })));
  await db.delete(s.productImages).where(eq(s.productImages.productId, pid));
  if (imageIds.length) await db.insert(s.productImages).values([...new Set(imageIds)].map((m, i) => ({ productId: pid!, mediaId: m, position: i })));
  if (type === "bundle") {
    const errs = await setBundleItems(pid!, bundleItems);
    if (errs.length) { refreshStore(); redirect(`/admin/products/${pid}/?msg=${encodeURIComponent("Error: " + errs.join("; "))}`); }
  } else await db.delete(s.productBundleItems).where(eq(s.productBundleItems.bundleId, pid!));
  await refreshBundleStock([pid!]); // its own bundle status, plus any bundles that contain it
  refreshStore();
  redirect(`/admin/products/${pid}/?msg=${encodeURIComponent(id ? "Product updated" : "Product created")}`);
}

export async function trashProduct(fd: FormData) {
  await requireStaff();
  await trashProducts([Number(fd.get("id"))]);
  await refreshBundleStock([Number(fd.get("id"))]);
  refreshStore();
  redirect(`/admin/products/?msg=${encodeURIComponent("Product moved to the trash")}`);
}

export async function restoreProduct(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  await restoreProducts([id]);
  await refreshBundleStock([id]);
  refreshStore();
  redirect(`/admin/products/${id}/?msg=${encodeURIComponent("Product restored")}`);
}

/** Permanent delete, only for products already in the trash */
export async function deleteProduct(fd: FormData) {
  await requireStaff();
  await deleteProductsForever([Number(fd.get("id"))]);
  await refreshBundleStock([Number(fd.get("id"))]);
  refreshStore();
  redirect("/admin/products/?status=trash&msg=Product%20permanently%20deleted");
}

export async function duplicateProduct(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  const p = await db.query.products.findFirst({ where: eq(s.products.id, id) }); if (!p) return;
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p;
  const [r] = await db.insert(s.products).values({ ...rest, name: p.name + " (copy)", slug: await uniqueSlug(p.slug + "-copy"), sku: null, status: "draft", trashedAt: null, statusBeforeTrash: null, totalSales: 0, views: 0 }).$returningId();
  for (const [t, col] of [[s.productCategories, "categoryId"], [s.productBrands, "brandId"], [s.productTags, "tagId"]] as const) {
    const rows = await db.select().from(t).where(eq(t.productId, id));
    if (rows.length) await db.insert(t).values(rows.map((x: any) => ({ productId: r.id, [col]: x[col] })) as any);
  }
  const imgs = await db.select().from(s.productImages).where(eq(s.productImages.productId, id));
  if (imgs.length) await db.insert(s.productImages).values(imgs.map((x) => ({ ...x, productId: r.id })));
  const parts = await db.select().from(s.productBundleItems).where(eq(s.productBundleItems.bundleId, id));
  if (parts.length) await db.insert(s.productBundleItems).values(parts.map((x) => ({ ...x, bundleId: r.id })));
  redirect(`/admin/products/${r.id}/?msg=Duplicated%20as%20draft`);
}

export async function bulkProducts(fd: FormData) {
  await requireStaff();
  const sel = fd.getAll("sel").map(Number).filter(Boolean); const action = str(fd, "bulk");
  if (sel.length) {
    if (action === "publish" || action === "draft") await db.update(s.products).set({ status: action === "publish" ? "published" : "draft" }).where(and(inArray(s.products.id, sel), ne(s.products.status, "trash")));
    if (action === "instock" || action === "outofstock") await db.update(s.products).set({ stockStatus: action }).where(inArray(s.products.id, sel));
    if (action === "feature" || action === "unfeature") await db.update(s.products).set({ featured: action === "feature" }).where(inArray(s.products.id, sel));
    if (action === "trash") await trashProducts(sel);
    if (action === "restore") await restoreProducts(sel);
    if (action === "delete") await deleteProductsForever(sel);
    await refreshBundleStock(sel);
    refreshStore();
  }
  redirect(`/admin/products/?${str(fd, "qs")}${str(fd, "qs") ? "&" : ""}msg=${encodeURIComponent(`${sel.length} product(s) updated`)}`);
}

/** Inline price / stock edit from the list */
export async function quickEdit(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id")); const price = numOrNull(str(fd, "regularPrice")); const qty = str(fd, "stockQty");
  const p = await db.query.products.findFirst({ where: eq(s.products.id, id) }); if (!p) return;
  await db.update(s.products).set({
    ...(price !== null ? { regularPrice: price } : {}),
    ...(p.manageStock && qty !== "" ? { stockQty: Number(qty), stockStatus: Number(qty) > 0 ? "instock" : "outofstock" } : {}),
  }).where(eq(s.products.id, id));
  await refreshBundleStock([id]);
  refreshStore();
}
