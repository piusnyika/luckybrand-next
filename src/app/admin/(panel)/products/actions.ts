"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { uniqueSlug } from "@/lib/admin/product-csv";
import { trashProducts, restoreProducts, deleteProductsForever } from "@/lib/admin/product-trash";
import { setBundleItems, refreshBundleStock } from "@/lib/bundles";
import { prisma, jsonOrNull } from "@/lib/prisma";

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
    const clash = await prisma.product.findFirst({ where: id ? { sku, id: { not: id } } : { sku } });
    if (clash) redirect(`/admin/products/${id ?? "new"}/?msg=${encodeURIComponent(`Error: SKU ${sku} is already used by “${clash.name}”${clash.status === "trash" ? " (in the trash)" : ""}`)}`);
  }
  const current = id ? await prisma.product.findUnique({ where: { id }, select: { status: true } }) : null;
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
    attributes: jsonOrNull(attributes.length ? attributes : null), seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription"), focusKeyword: str(fd, "focusKeyword"),
    primaryCategoryId: Number(fd.get("primaryCategoryId")) || categoryIds[0] || null, imageId: imageIds[0] ?? null,
  };
  let pid = id;
  if (pid) await prisma.product.update({ where: { id: pid }, data });
  else pid = (await prisma.product.create({ data, select: { id: true } })).id;

  await prisma.productCategory.deleteMany({ where: { productId: pid } });
  if (categoryIds.length) await prisma.productCategory.createMany({ data: categoryIds.map((c) => ({ productId: pid!, categoryId: c })) });
  await prisma.productBrand.deleteMany({ where: { productId: pid } });
  const brandIds = ids(fd, "brands"); if (brandIds.length) await prisma.productBrand.createMany({ data: brandIds.map((b) => ({ productId: pid!, brandId: b })) });
  await prisma.productTag.deleteMany({ where: { productId: pid } });
  const tagIds = [...ids(fd, "tags")];
  for (const t of str(fd, "newTags").split(",").map((x) => x.trim()).filter(Boolean)) {
    const slug = slugify(t); const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) tagIds.push((await prisma.tag.create({ data: { name: t, slug }, select: { id: true } })).id); else tagIds.push(tag.id);
  }
  if (tagIds.length) await prisma.productTag.createMany({ data: [...new Set(tagIds)].map((t) => ({ productId: pid!, tagId: t })) });
  await prisma.productImage.deleteMany({ where: { productId: pid } });
  if (imageIds.length) await prisma.productImage.createMany({ data: [...new Set(imageIds)].map((m, i) => ({ productId: pid!, mediaId: m, position: i })) });
  if (type === "bundle") {
    const errs = await setBundleItems(pid!, bundleItems);
    if (errs.length) { refreshStore(); redirect(`/admin/products/${pid}/?msg=${encodeURIComponent("Error: " + errs.join("; "))}`); }
  } else await prisma.productBundleItem.deleteMany({ where: { bundleId: pid! } });
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
  const p = await prisma.product.findUnique({ where: { id }, include: { categories: true, brands: true, tags: true, images: true, bundleItems: true } }); if (!p) return;
  const { id: _i, createdAt: _c, updatedAt: _u, categories, brands, tags, images, bundleItems, attributes, ...rest } = p;
  const r = await prisma.product.create({ select: { id: true }, data: {
    ...rest, attributes: jsonOrNull(attributes), name: p.name + " (copy)", slug: await uniqueSlug(p.slug + "-copy"), sku: null, status: "draft", trashedAt: null, statusBeforeTrash: null, totalSales: 0, views: 0,
    categories: { create: categories.map((x) => ({ categoryId: x.categoryId })) },
    brands: { create: brands.map((x) => ({ brandId: x.brandId })) },
    tags: { create: tags.map((x) => ({ tagId: x.tagId })) },
    images: { create: images.map((x) => ({ mediaId: x.mediaId, position: x.position })) },
    bundleItems: { create: bundleItems.map((x) => ({ productId: x.productId, qty: x.qty, position: x.position })) },
  } });
  redirect(`/admin/products/${r.id}/?msg=Duplicated%20as%20draft`);
}

export async function bulkProducts(fd: FormData) {
  await requireStaff();
  const sel = fd.getAll("sel").map(Number).filter(Boolean); const action = str(fd, "bulk");
  if (sel.length) {
    if (action === "publish" || action === "draft") await prisma.product.updateMany({ where: { id: { in: sel }, status: { not: "trash" } }, data: { status: action === "publish" ? "published" : "draft" } });
    if (action === "instock" || action === "outofstock") await prisma.product.updateMany({ where: { id: { in: sel } }, data: { stockStatus: action } });
    if (action === "feature" || action === "unfeature") await prisma.product.updateMany({ where: { id: { in: sel } }, data: { featured: action === "feature" } });
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
  const p = await prisma.product.findUnique({ where: { id } }); if (!p) return;
  await prisma.product.update({ where: { id }, data: {
    ...(price !== null ? { regularPrice: price } : {}),
    ...(p.manageStock && qty !== "" ? { stockQty: Number(qty), stockStatus: Number(qty) > 0 ? "instock" : "outofstock" } : {}),
  } });
  await refreshBundleStock([id]);
  refreshStore();
}

/* ---------- tidy-up: tables in descriptions → Specifications (Products page banner) ---------- */
const TABLES_BACKUP = "specTablesBackup";
type TablesBackup = { at: string; items: { id: number; description: string | null; specification: string | null }[] };

/** Moves the tables of every product's description into its Specifications. Keeps the previous text so it can be undone. */
export async function moveAllDescriptionTables() {
  await requireStaff();
  const { moveTablesToSpec } = await import("@/lib/spec-tables");
  const rows = await prisma.product.findMany({ where: { description: { contains: "<table", mode: "insensitive" } }, select: { id: true, description: true, specification: true } });
  const changed = rows.map((r) => ({ r, x: moveTablesToSpec(r.description, r.specification) }))
    .filter(({ r, x }) => x.description !== (r.description ?? "") || x.specification !== (r.specification ?? ""));
  if (!changed.length) redirect("/admin/products/?msg=No%20tables%20to%20move");
  const backup: TablesBackup = { at: new Date().toISOString(), items: changed.map(({ r }) => r) };
  await prisma.setting.upsert({ where: { key: TABLES_BACKUP }, create: { key: TABLES_BACKUP, value: backup }, update: { value: backup } });
  await prisma.$transaction(changed.map(({ r, x }) => prisma.product.update({ where: { id: r.id }, data: { description: x.description, specification: x.specification } })));
  const moved = changed.reduce((n, c) => n + c.x.moved, 0);
  refreshStore();
  redirect(`/admin/products/?msg=${encodeURIComponent(`Moved ${moved} tables to Specifications in ${changed.length} products`)}`);
}

/** Puts back the descriptions and specifications from before the last "move tables" */
export async function undoMoveDescriptionTables() {
  await requireStaff();
  const row = await prisma.setting.findUnique({ where: { key: TABLES_BACKUP } });
  const b = row?.value as TablesBackup | undefined;
  if (!b?.items?.length) redirect("/admin/products/?msg=Nothing%20to%20undo");
  await prisma.$transaction([
    ...b.items.map((i) => prisma.product.updateMany({ where: { id: i.id }, data: { description: i.description, specification: i.specification } })),
    prisma.setting.delete({ where: { key: TABLES_BACKUP } }),
  ]);
  refreshStore();
  redirect(`/admin/products/?msg=${encodeURIComponent(`Restored ${b.items.length} products`)}`);
}

/** Keep the change: forget the backup */
export async function keepMovedDescriptionTables() {
  await requireStaff();
  await prisma.setting.deleteMany({ where: { key: TABLES_BACKUP } });
  redirect("/admin/products/?msg=Done");
}
