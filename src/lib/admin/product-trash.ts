import "server-only";
import { db, schema as s } from "@/db";
import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";

export const TRASH_DAYS = 30;

export async function trashProducts(ids: number[]) {
  if (!ids.length) return;
  const live = and(inArray(s.products.id, ids), ne(s.products.status, "trash"));
  // two steps: MySQL applies SET left to right, so one UPDATE would copy the new status
  await db.transaction(async (tx) => {
    await tx.update(s.products).set({ statusBeforeTrash: sql`${s.products.status}` }).where(live);
    await tx.update(s.products).set({ status: "trash", trashedAt: new Date() }).where(live);
  });
}

export async function restoreProducts(ids: number[]) {
  if (!ids.length) return;
  await db.update(s.products).set({ status: sql`COALESCE(${s.products.statusBeforeTrash}, 'draft')`, trashedAt: null, statusBeforeTrash: null })
    .where(and(inArray(s.products.id, ids), eq(s.products.status, "trash")));
}

/** Permanent delete. Only products already in the trash; past orders keep their line items. */
export async function deleteProductsForever(ids: number[]) {
  if (!ids.length) return 0;
  const rows = await db.select({ id: s.products.id }).from(s.products).where(and(inArray(s.products.id, ids), eq(s.products.status, "trash")));
  const del = rows.map((r) => r.id);
  if (!del.length) return 0;
  await db.transaction(async (tx) => {
    for (const t of [s.productCategories, s.productBrands, s.productTags, s.productImages]) await tx.delete(t).where(inArray(t.productId, del));
    // a deleted bundle loses its item list; a deleted item stays listed in its bundles (shown as "deleted", bundle goes out of stock)
    await tx.delete(s.productBundleItems).where(inArray(s.productBundleItems.bundleId, del));
    await tx.update(s.orderItems).set({ productId: null }).where(inArray(s.orderItems.productId, del));
    await tx.delete(s.products).where(inArray(s.products.id, del));
  });
  return del.length;
}

export async function purgeExpiredTrash() {
  const old = await db.select({ id: s.products.id }).from(s.products)
    .where(and(eq(s.products.status, "trash"), lt(s.products.trashedAt, new Date(Date.now() - TRASH_DAYS * 86_400_000))));
  return deleteProductsForever(old.map((r) => r.id));
}
