import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Bundles: a product (type "bundle") made of other products by quantity. Bundles hold no stock of their own:
 * selling one takes stock from its items, and its in/out of stock status follows them.
 */
export type BundleItem = {
  productId: number; qty: number; name: string; sku: string; slug: string; image: string | null;
  price: number; status: string; stockStatus: string; manageStock: boolean; stockQty: number | null; missing: boolean;
};

/** Items of the given bundles, keyed by bundle id (in admin order). Deleted items come back as `missing`. */
export async function getBundleItems(bundleIds: number[]): Promise<Map<number, BundleItem[]>> {
  const out = new Map<number, BundleItem[]>();
  if (!bundleIds.length) return out;
  // product_bundle_items.product_id has no foreign key on purpose: a deleted item stays listed (as missing) so the bundle stops selling
  const rows = await prisma.productBundleItem.findMany({ where: { bundleId: { in: bundleIds } }, orderBy: { position: "asc" } });
  const prods = await prisma.product.findMany({ where: { id: { in: [...new Set(rows.map((b) => b.productId))] } }, include: { image: { select: { url: true } } } });
  const byId = new Map(prods.map((p) => [p.id, p]));
  const { effectivePrice } = await import("./catalog");
  for (const b of rows) {
    const p = byId.get(b.productId);
    const item: BundleItem = p
      ? { productId: p.id, qty: b.qty, name: p.name, sku: p.sku || "", slug: p.slug, image: p.image?.url ?? null, price: effectivePrice(p).price, status: p.status, stockStatus: p.stockStatus, manageStock: p.manageStock, stockQty: p.stockQty, missing: false }
      : { productId: b.productId, qty: b.qty, name: `Deleted product #${b.productId}`, sku: "", slug: "", image: null, price: 0, status: "trash", stockStatus: "outofstock", manageStock: false, stockQty: null, missing: true };
    out.set(b.bundleId, [...(out.get(b.bundleId) ?? []), item]);
  }
  return out;
}
/** How many of a bundle can be sold right now: null = unlimited, 0 = unavailable */
export function bundleMaxQty(items: BundleItem[]) {
  if (!items.length) return 0;
  let max: number | null = null;
  for (const i of items) {
    if (i.missing || i.status !== "published" || i.stockStatus === "outofstock") return 0;
    if (i.manageStock && i.stockStatus !== "onbackorder") {
      const n = Math.floor(Math.max(0, i.stockQty ?? 0) / Math.max(1, i.qty));
      max = max === null ? n : Math.min(max, n);
    }
  }
  return max;
}

/** A bundle costs what its items cost together, at their current prices */
export const bundlePrice = (items: BundleItem[]) => Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 100) / 100;

/**
 * Recalculates the price and stock status of bundles (all, or those containing any of `productIds`) from their items,
 * so shop listings, sorting and filters stay right. Call after anything changes an item's price, stock or status.
 */
export async function refreshBundleStock(productIds?: number[]) {
  let bundleIds: number[];
  if (productIds) {
    if (!productIds.length) return;
    const rows = await prisma.productBundleItem.findMany({ where: { productId: { in: productIds } }, select: { bundleId: true }, distinct: ["bundleId"] });
    const direct = await prisma.product.findMany({ where: { id: { in: productIds }, type: "bundle" }, select: { id: true } });
    bundleIds = [...new Set([...rows.map((r) => r.bundleId), ...direct.map((r) => r.id)])];
  } else {
    bundleIds = (await prisma.product.findMany({ where: { type: "bundle" }, select: { id: true } })).map((r) => r.id);
  }
  if (!bundleIds.length) return;
  const items = await getBundleItems(bundleIds);
  for (const id of bundleIds) {
    const list = items.get(id) ?? [];
    await prisma.product.updateMany({ where: { id, type: "bundle" }, data: { stockStatus: bundleMaxQty(list) === 0 ? "outofstock" : "instock", manageStock: false, stockQty: null,
      regularPrice: bundlePrice(list).toFixed(2), salePrice: null, saleFrom: null, saleTo: null } });
  }
}

/** Snapshot stored on the order line: what one bundle contained when ordered */
export const snapshot = (items: BundleItem[]) => items.filter((i) => !i.missing).map((i) => ({ productId: i.productId, sku: i.sku, name: i.name, qty: i.qty }));

/** CSV "bundle_items" cell: "SKU*2 | SKU x1 | #123*3" (#id for products without a SKU; qty defaults to 1) */
export function parseBundleSpec(cell: string) {
  return cell.split(/[|\n]/).map((x) => x.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^(.*?)\s*(?:[*x×]\s*(\d+))?$/i)!;
    const ref = m[1].trim(); const qty = Math.max(1, Number(m[2] || 1));
    return /^#\d+$/.test(ref) ? { productId: Number(ref.slice(1)), qty } : { sku: ref, qty };
  });
}
export const formatBundleSpec = (items: { sku: string; productId: number; qty: number }[]) => items.map((i) => `${i.sku || "#" + i.productId}*${i.qty}`).join(" | ");

/** Checks a bundle's items without saving: unknown SKUs, the bundle itself, bundles inside bundles */
export async function resolveBundleItems(bundleId: number | null, items: { productId?: number; sku?: string; qty: number }[]) {
  const errors: string[] = []; const rows: { productId: number; qty: number }[] = [];
  for (const it of items) {
    const p = it.productId
      ? await prisma.product.findUnique({ where: { id: it.productId } })
      : it.sku ? await prisma.product.findFirst({ where: { sku: it.sku } }) : undefined;
    const label = it.sku || `#${it.productId}`;
    if (!p || p.status === "trash") { errors.push(`No product with SKU ${label}`); continue; }
    if (bundleId !== null && p.id === bundleId) { errors.push("A bundle can't contain itself"); continue; }
    if (p.type === "bundle") { errors.push(`“${p.name}” is itself a bundle; bundles can't contain bundles`); continue; }
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const ex = rows.find((r) => r.productId === p.id);
    if (ex) ex.qty += qty; else rows.push({ productId: p.id, qty });
  }
  if (!errors.length && !rows.length) errors.push("A bundle needs at least one product");
  return { rows, errors };
}

/**
 * Saves a bundle's items from SKU/qty pairs (admin form, CSV import). Rejects unknown SKUs,
 * the bundle itself and other bundles (no bundles inside bundles).
 */
export async function setBundleItems(bundleId: number, items: { productId?: number; sku?: string; qty: number }[]) {
  const { rows, errors } = await resolveBundleItems(bundleId, items);
  if (!errors.length) {
    await prisma.$transaction([
      prisma.productBundleItem.deleteMany({ where: { bundleId } }),
      prisma.productBundleItem.createMany({ data: rows.map((r, i) => ({ bundleId, productId: r.productId, qty: r.qty, position: i })) }),
    ]);
    await refreshBundleStock([bundleId]);
  }
  return errors;
}
