import "server-only";
import { db, schema as s } from "@/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { effectivePrice } from "./catalog";
import { randomBytes } from "crypto";
import type { Address, BundleSnapshot } from "@/db/schema";
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
  const rows = ids.length ? await db.select({ p: s.products, image: s.media.url }).from(s.products)
    .leftJoin(s.media, eq(s.media.id, s.products.imageId)).where(inArray(s.products.id, ids)) : [];
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
    lines.push({ id: r.p.id, name: r.p.name, slug: r.p.slug, sku: r.p.sku || "", image: r.image ?? null, price, qty, total: round(price * qty), maxQty, error, ...(items ? { includes: snapshot(items) } : {}) });
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
    const c = await db.query.coupons.findFirst({ where: eq(s.coupons.code, couponCode.trim().toLowerCase()) });
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
  const methods = await db.select().from(s.shippingMethods).where(eq(s.shippingMethods.enabled, true)).orderBy(asc(s.shippingMethods.sortOrder));
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

export async function createOrder(args: {
  quote: Quote; billing: Address; shipping: Address | null; email: string; phone: string; note: string;
  paymentMethod: string; paymentMethodTitle: string; userId: number | null; ip: string;
}) {
  const { quote } = args;
  const ship = quote.shippingOptions.find((o) => o.id === quote.shippingMethodId);
  const accessKey = "wc_order_" + randomBytes(10).toString("hex");
  const orderId = await db.transaction(async (tx) => {
    const [r] = await tx.insert(s.orders).values({
      number: "tmp-" + accessKey, status: "pending", userId: args.userId, email: args.email.toLowerCase(), phone: args.phone,
      subtotal: quote.subtotal.toFixed(2), discountTotal: quote.discount.toFixed(2), shippingTotal: quote.shipping.toFixed(2),
      taxTotal: "0", total: quote.total.toFixed(2), couponCode: quote.coupon?.code ?? null,
      paymentMethod: args.paymentMethod, paymentMethodTitle: args.paymentMethodTitle,
      billing: args.billing, shipping: args.shipping, shippingMethod: ship?.name ?? "", customerNote: args.note, ipAddress: args.ip, accessKey,
    }).$returningId();
    await tx.update(s.orders).set({ number: String(r.id) }).where(eq(s.orders.id, r.id));
    await tx.insert(s.orderItems).values(quote.lines.map((l) => ({ orderId: r.id, productId: l.id, name: l.name, sku: l.sku, quantity: l.qty, unitPrice: l.price.toFixed(2), total: l.total.toFixed(2), bundle: l.includes ?? null })));
    // reserve stock (bundles: from each item they contain)
    for (const l of quote.lines) {
      for (const part of l.includes ?? [{ productId: l.id, qty: 1 }]) {
        const n = part.qty * l.qty;
        await tx.update(s.products).set({
          stockQty: sql`CASE WHEN ${s.products.manageStock} THEN GREATEST(0, COALESCE(${s.products.stockQty},0) - ${n}) ELSE ${s.products.stockQty} END`,
          stockStatus: sql`CASE WHEN ${s.products.manageStock} AND COALESCE(${s.products.stockQty},0) - ${n} <= 0 AND ${s.products.stockStatus} <> 'onbackorder' THEN 'outofstock' ELSE ${s.products.stockStatus} END`,
        }).where(eq(s.products.id, part.productId));
      }
      await tx.update(s.products).set({ totalSales: sql`${s.products.totalSales} + ${l.qty}` }).where(eq(s.products.id, l.id));
    }
    if (quote.coupon) await tx.update(s.coupons).set({ usageCount: sql`${s.coupons.usageCount} + 1` }).where(eq(s.coupons.code, quote.coupon.code));
    return r.id;
  });
  await refreshBundleStock(quote.lines.flatMap((l) => (l.includes ?? []).map((i) => i.productId).concat(l.id)));
  await addNote(orderId, "Order created.", false, "system");
  return (await getOrder(orderId))!;
}

export async function getOrder(id: number) {
  const o = await db.query.orders.findFirst({ where: eq(s.orders.id, id) });
  if (!o) return null;
  const [items, notes] = await Promise.all([
    db.select({ i: s.orderItems, slug: s.products.slug, image: s.media.url }).from(s.orderItems)
      .leftJoin(s.products, eq(s.products.id, s.orderItems.productId)).leftJoin(s.media, eq(s.media.id, s.products.imageId))
      .where(eq(s.orderItems.orderId, id)).orderBy(asc(s.orderItems.id)),
    db.select().from(s.orderNotes).where(eq(s.orderNotes.orderId, id)).orderBy(asc(s.orderNotes.createdAt), asc(s.orderNotes.id)),
  ]);
  return { ...o, items: items.map((x) => ({ ...x.i, slug: x.slug, image: x.image })), notes };
}
export type FullOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function addNote(orderId: number, content: string, isCustomer = false, author = "system") {
  await db.insert(s.orderNotes).values({ orderId, content, isCustomer, author });
}

/** Change status, restock on cancel/fail/refund, stamp dates, send the matching emails. */
export async function setOrderStatus(orderId: number, status: (typeof s.orders.$inferSelect)["status"], by = "system", note?: string, notify = true) {
  const o = await getOrder(orderId);
  if (!o || o.status === status) return o;
  const patch: Partial<typeof s.orders.$inferInsert> = { status };
  if ((status === "processing" || status === "completed") && !o.paidAt && o.paymentMethod !== "cod") patch.paidAt = new Date();
  if (status === "completed") patch.completedAt = new Date();
  await db.update(s.orders).set(patch).where(eq(s.orders.id, orderId));
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
      const n = dir * part.qty * it.quantity;
      touched.push(part.productId);
      await db.update(s.products).set({
        stockQty: sql`CASE WHEN ${s.products.manageStock} THEN GREATEST(0, COALESCE(${s.products.stockQty},0) + ${n}) ELSE ${s.products.stockQty} END`,
        stockStatus: sql`CASE WHEN ${s.products.manageStock} AND COALESCE(${s.products.stockQty},0) + ${n} > 0 AND ${s.products.stockStatus} = 'outofstock' THEN 'instock' WHEN ${s.products.manageStock} AND COALESCE(${s.products.stockQty},0) + ${n} <= 0 AND ${s.products.stockStatus} = 'instock' THEN 'outofstock' ELSE ${s.products.stockStatus} END`,
      }).where(eq(s.products.id, part.productId));
    }
  }
  await refreshBundleStock(touched);
}
