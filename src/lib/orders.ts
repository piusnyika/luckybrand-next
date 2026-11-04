import "server-only";
import { prisma, jsonOrNull, type Db, type Prisma } from "@/lib/prisma";
import { effectivePrice } from "./catalog";
import { randomBytes } from "crypto";
import type { Address, BundleSnapshot, OrderStatus } from "@/lib/db-types";
import { getBundleItems, bundleMaxQty, bundlePrice, snapshot, refreshBundleStock } from "./bundles";

export type CartInput = { id: number; qty: number }[];
export type QuoteLine = {
  id: number; name: string; slug: string; sku: string; image: string | null; price: number; qty: number; total: number; maxQty: number | null; error?: string;
  /** bundles: what one unit contains */
  includes?: BundleSnapshot;
};
export type ShippingOption = { id: number; name: string; type: "free" | "flat" | "pickup"; cost: number };
export type Quote = {
  lines: QuoteLine[]; subtotal: number; discount: number; shipping: number; total: number;
  coupon: { code: string; freeShipping: boolean } | null; couponError?: string;
  shippingOptions: ShippingOption[]; shippingMethodId: number | null; errors: string[];
};

export async function quoteCart(input: CartInput, couponCode?: string | null, shippingMethodId?: number | null): Promise<Quote> {
  const ids = [...new Set(input.map((l) => Number(l.id)).filter(Boolean))];
  const rows = ids.length
    ? (await prisma.product.findMany({ where: { id: { in: ids } }, include: { image: { select: { url: true } } } })).map(({ image, ...p }) => ({ p, image: image?.url ?? null }))
    : [];
  const byId = new Map(rows.map((r) => [r.p.id, r]));
  const bundles = await getBundleItems(rows.filter((r) => r.p.type === "bundle").map((r) => r.p.id));
  const errors: string[] = [];
  const lines: QuoteLine[] = [];
  for (const l of input) {
    const r = byId.get(Number(l.id));
    if (!r || r.p.status !== "published") { errors.push("A product in your cart is no longer available and was removed."); continue; }
    const qty = Math.max(1, Math.floor(Number(l.qty) || 1));
    const items = r.p.type === "bundle" ? bundles.get(r.p.id) ?? [] : null;
    const price = items ? bundlePrice(items) : effectivePrice(r.p).price;
    const maxQty = items ? bundleMaxQty(items) : r.p.manageStock && r.p.stockStatus !== "onbackorder" ? Math.max(0, r.p.stockQty ?? 0) : null;
    let error: string | undefined;
    if ((!items && r.p.stockStatus === "outofstock") || maxQty === 0) error = `“${r.p.name}” is out of stock.`;
    else if (maxQty !== null && qty > maxQty) error = `Only ${maxQty} of “${r.p.name}” in stock.`;
    if (error) errors.push(error);
    lines.push({ id: r.p.id, name: r.p.name, slug: r.p.slug, sku: r.p.sku || "", image: r.image, price, qty, total: round(price * qty), maxQty, error, ...(items ? { includes: snapshot(items) } : {}) });
  }
  // the same product can be wanted both on its own and inside bundles: check the combined quantity
  if (bundles.size) {
    const need = new Map<number, number>(); const stock = new Map<number, { name: string; qty: number | null }>();
    for (const l of lines) {
      const items = bundles.get(l.id);
      if (items) for (const i of items) {
        need.set(i.productId, (need.get(i.productId) ?? 0) + i.qty * l.qty);
        stock.set(i.productId, { name: i.name, qty: i.manageStock && i.stockStatus !== "onbackorder" ? Math.max(0, i.stockQty ?? 0) : null });
      } else {
        const p = byId.get(l.id)!.p;
        need.set(l.id, (need.get(l.id) ?? 0) + l.qty);
        if (!stock.has(l.id)) stock.set(l.id, { name: p.name, qty: p.manageStock && p.stockStatus !== "onbackorder" ? Math.max(0, p.stockQty ?? 0) : null });
      }
    }
    for (const [id, n] of need) {
      const st = stock.get(id);
      if (st?.qty === null || st === undefined || n <= st.qty) continue;
      const msg = `Only ${st.qty} of “${st.name}” in stock, but your cart needs ${n} (including bundles).`;
      if (!errors.includes(msg)) errors.push(msg);
      for (const l of lines) if (!l.error && (l.id === id || bundles.get(l.id)?.some((i) => i.productId === id))) l.error = msg;
    }
  }
  const subtotal = round(lines.reduce((a, l) => a + l.total, 0));

  // coupon
  let discount = 0; let coupon: Quote["coupon"] = null; let couponError: string | undefined;
  if (couponCode) {
    const c = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toLowerCase() } });
    if (!c || !c.active) couponError = `Coupon “${couponCode}” does not exist.`;
    else if (c.expiresAt && c.expiresAt.getTime() < Date.now()) couponError = "This coupon has expired.";
    else if (c.usageLimit !== null && c.usageCount >= c.usageLimit) couponError = "Coupon usage limit has been reached.";
    else if (c.minSpend !== null && subtotal < Number(c.minSpend)) couponError = `The minimum spend for this coupon is $${Number(c.minSpend).toFixed(2)}.`;
    else if (c.maxSpend !== null && subtotal > Number(c.maxSpend)) couponError = `The maximum spend for this coupon is $${Number(c.maxSpend).toFixed(2)}.`;
    else {
      const amt = Number(c.amount);
      discount = c.type === "percent" ? subtotal * (amt / 100) : c.type === "fixed_cart" ? amt : lines.reduce((a, l) => a + Math.min(l.price, amt) * l.qty, 0);
      discount = round(Math.min(discount, subtotal));
      coupon = { code: c.code, freeShipping: c.freeShipping };
    }
  }

  // shipping
  const methods = await prisma.shippingMethod.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  const after = subtotal - discount;
  const options: ShippingOption[] = methods
    .filter((m) => m.type !== "free" || m.minAmount === null || after >= Number(m.minAmount) || coupon?.freeShipping)
    .map((m) => ({ id: m.id, name: m.name, type: m.type, cost: m.type === "flat" && !coupon?.freeShipping ? Number(m.cost) : m.type === "pickup" ? Number(m.cost) : 0 }));
  // de-duplicate identical options (e.g. two "Free shipping" zones)
  const seen = new Set<string>(); const shippingOptions = options.filter((o) => { const k = o.type + o.name + o.cost; if (seen.has(k)) return false; seen.add(k); return true; });
  const chosen = shippingOptions.find((o) => o.id === Number(shippingMethodId)) ?? shippingOptions[0] ?? null;
  const shipping = chosen?.cost ?? 0;

  return { lines, subtotal, discount, shipping, total: round(after + shipping), coupon, couponError, shippingOptions, shippingMethodId: chosen?.id ?? null, errors };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Takes `n` from a product's stock for an order (Postgres evaluates every SET against the old row) */
async function reserveStock(db: Db, productId: number, n: number) {
  await db.$executeRaw`UPDATE products SET
    stock_qty = CASE WHEN manage_stock THEN GREATEST(0, COALESCE(stock_qty, 0) - ${n}) ELSE stock_qty END,
    stock_status = CASE WHEN manage_stock AND COALESCE(stock_qty, 0) - ${n} <= 0 AND stock_status <> 'onbackorder' THEN 'outofstock' ELSE stock_status END
    WHERE id = ${productId}`;
}

/** Puts `n` back into a product's stock (negative takes it again), keeping its in/out of stock status in line */
async function restockBy(productId: number, n: number) {
  await prisma.$executeRaw`UPDATE products SET
    stock_qty = CASE WHEN manage_stock THEN GREATEST(0, COALESCE(stock_qty, 0) + ${n}) ELSE stock_qty END,
    stock_status = CASE
      WHEN manage_stock AND COALESCE(stock_qty, 0) + ${n} > 0 AND stock_status = 'outofstock' THEN 'instock'
      WHEN manage_stock AND COALESCE(stock_qty, 0) + ${n} <= 0 AND stock_status = 'instock' THEN 'outofstock'
      ELSE stock_status END
    WHERE id = ${productId}`;
}

export async function createOrder(args: {
  quote: Quote; billing: Address; shipping: Address | null; email: string; phone: string; note: string;
  paymentMethod: string; paymentMethodTitle: string; userId: number | null; ip: string;
}) {
  const { quote } = args;
  const ship = quote.shippingOptions.find((o) => o.id === quote.shippingMethodId);
  const accessKey = "wc_order_" + randomBytes(10).toString("hex");
  const orderId = await prisma.$transaction(async (tx) => {
    const r = await tx.order.create({
      data: {
        number: "tmp-" + accessKey, status: "pending", userId: args.userId, email: args.email.toLowerCase(), phone: args.phone,
        subtotal: quote.subtotal.toFixed(2), discountTotal: quote.discount.toFixed(2), shippingTotal: quote.shipping.toFixed(2),
        taxTotal: "0", total: quote.total.toFixed(2), couponCode: quote.coupon?.code ?? null,
        paymentMethod: args.paymentMethod, paymentMethodTitle: args.paymentMethodTitle,
        billing: args.billing, shipping: jsonOrNull(args.shipping), shippingMethod: ship?.name ?? "", customerNote: args.note, ipAddress: args.ip, accessKey,
        items: { create: quote.lines.map((l) => ({ productId: l.id, name: l.name, sku: l.sku, quantity: l.qty, unitPrice: l.price.toFixed(2), total: l.total.toFixed(2), bundle: jsonOrNull(l.includes) })) },
      },
      select: { id: true },
    });
    await tx.order.update({ where: { id: r.id }, data: { number: String(r.id) } });
    // reserve stock (bundles: from each item they contain)
    for (const l of quote.lines) {
      for (const part of l.includes ?? [{ productId: l.id, qty: 1 }]) await reserveStock(tx, part.productId, part.qty * l.qty);
      await tx.product.updateMany({ where: { id: l.id }, data: { totalSales: { increment: l.qty } } });
    }
    if (quote.coupon) await tx.coupon.updateMany({ where: { code: quote.coupon.code }, data: { usageCount: { increment: 1 } } });
    return r.id;
  });
  await refreshBundleStock(quote.lines.flatMap((l) => (l.includes ?? []).map((i) => i.productId).concat(l.id)));
  await addNote(orderId, "Order created.", false, "system");
  return (await getOrder(orderId))!;
}

export async function getOrder(id: number) {
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o) return null;
  const [items, notes] = await Promise.all([
    prisma.orderItem.findMany({ where: { orderId: id }, orderBy: { id: "asc" }, include: { product: { select: { slug: true, image: { select: { url: true } } } } } }),
    prisma.orderNote.findMany({ where: { orderId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);
  return { ...o, items: items.map(({ product, ...i }) => ({ ...i, slug: product?.slug ?? null, image: product?.image?.url ?? null })), notes };
}
export type FullOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function addNote(orderId: number, content: string, isCustomer = false, author = "system") {
  await prisma.orderNote.create({ data: { orderId, content, isCustomer, author } });
}

/** Change status, restock on cancel/fail/refund, stamp dates, send the matching emails. */
export async function setOrderStatus(orderId: number, status: OrderStatus, by = "system", note?: string, notify = true) {
  const o = await getOrder(orderId);
  if (!o || o.status === status) return o;
  const patch: Prisma.OrderUpdateInput = { status };
  if ((status === "processing" || status === "completed") && !o.paidAt && o.paymentMethod !== "cod") patch.paidAt = new Date();
  if (status === "completed") patch.completedAt = new Date();
  await prisma.order.update({ where: { id: orderId }, data: patch });
  const releases = ["cancelled", "failed", "refunded"];
  if (releases.includes(status) && !releases.includes(o.status)) await restock(o, 1);
  if (!releases.includes(status) && releases.includes(o.status)) await restock(o, -1);
  await addNote(orderId, note ?? `Order status changed from ${o.status} to ${status}.`, false, by);
  if (notify) { // false e.g. when an abandoned, never-paid checkout times out
    const { sendOrderEmails } = await import("./mail");
    await sendOrderEmails(orderId, status, o.status).catch((e) => console.error("mail error", e));
  }
  return getOrder(orderId);
}

async function restock(o: FullOrder, dir: 1 | -1) {
  const touched: number[] = [];
  for (const it of o.items) {
    // bundles: the items they contained when ordered (stored on the order line)
    const parts = it.bundle?.length ? it.bundle : it.productId ? [{ productId: it.productId, qty: 1 }] : [];
    for (const part of parts) {
      touched.push(part.productId);
      await restockBy(part.productId, dir * part.qty * it.quantity);
    }
  }
  await refreshBundleStock(touched);
}
