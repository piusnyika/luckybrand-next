import "server-only";
import { prisma, Prisma } from "@/lib/prisma";

export const TRASH_DAYS = 30;

export async function trashProducts(ids: number[]) {
  if (!ids.length) return;
  // one UPDATE: Postgres reads every SET value from the old row, so status_before_trash gets the old status
  await prisma.$executeRaw`UPDATE products SET status_before_trash = status, status = 'trash', trashed_at = NOW()
    WHERE id IN (${Prisma.join(ids)}) AND status <> 'trash'`;
}

export async function restoreProducts(ids: number[]) {
  if (!ids.length) return;
  await prisma.$executeRaw`UPDATE products SET status = COALESCE(status_before_trash, 'draft'), trashed_at = NULL, status_before_trash = NULL
    WHERE id IN (${Prisma.join(ids)}) AND status = 'trash'`;
}

/** Permanent delete. Only products already in the trash; past orders keep their line items. */
export async function deleteProductsForever(ids: number[]) {
  if (!ids.length) return 0;
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, status: "trash" }, select: { id: true } });
  const del = rows.map((r) => r.id);
  if (!del.length) return 0;
  // categories, brands, tags, images and a bundle's own item list go with the product (ON DELETE CASCADE);
  // past order lines keep their details (product_id set to NULL). A deleted item stays listed in its bundles
  // (no foreign key there), shown as "deleted", and the bundle goes out of stock.
  await prisma.product.deleteMany({ where: { id: { in: del } } });
  return del.length;
}

export async function purgeExpiredTrash() {
  const old = await prisma.product.findMany({ where: { status: "trash", trashedAt: { lt: new Date(Date.now() - TRASH_DAYS * 86_400_000) } }, select: { id: true } });
  return deleteProductsForever(old.map((r) => r.id));
}
