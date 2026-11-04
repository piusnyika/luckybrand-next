import "server-only";
import { prisma, Prisma } from "@/lib/prisma";

/** Statuses that count as a sale (same as the dashboard) */
export const PAID = ["processing", "completed", "on-hold"];

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD → a range (to is inclusive); default: the last 12 months to today */
export function reportRange(sp: { from?: string; to?: string }) {
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00Z") : null);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const to = day(sp.to) ?? today;
  const from = day(sp.from) ?? new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth() + 1, 1));
  return { from, to, end: new Date(to.getTime() + 86_400_000), fromStr: from.toISOString().slice(0, 10), toStr: to.toISOString().slice(0, 10) };
}
type Range = ReturnType<typeof reportRange>;
const paid = (r: Range) => Prisma.sql`o.status IN (${Prisma.join(PAID)}) AND o.created_at >= ${r.from} AND o.created_at < ${r.end}`;

export async function salesReport(r: Range) {
  const [summary, months, categories, payments, products] = await Promise.all([
    prisma.$queryRaw<{ revenue: string; orders: bigint; discounts: string; shipping: string; items: bigint }[]>`
      SELECT COALESCE(SUM(o.total), 0)::text AS revenue, COUNT(*) AS orders, COALESCE(SUM(o.discount_total), 0)::text AS discounts, COALESCE(SUM(o.shipping_total), 0)::text AS shipping,
        (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${paid(r)}) AS items
      FROM orders o WHERE ${paid(r)}`,
    prisma.$queryRaw<{ month: string; revenue: string; orders: bigint }[]>`
      SELECT to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month, SUM(o.total)::text AS revenue, COUNT(*) AS orders
      FROM orders o WHERE ${paid(r)} GROUP BY 1 ORDER BY 1`,
    // by each product's main category (products without one are "Uncategorised")
    prisma.$queryRaw<{ category: string; revenue: string; qty: bigint }[]>`
      SELECT COALESCE(c.name, 'Uncategorised') AS category, SUM(oi.total)::text AS revenue, SUM(oi.quantity) AS qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.primary_category_id
      WHERE ${paid(r)} GROUP BY 1 ORDER BY SUM(oi.total) DESC`,
    prisma.$queryRaw<{ method: string; revenue: string; orders: bigint }[]>`
      SELECT COALESCE(NULLIF(split_part(o.payment_method_title, ' (', 1), ''), o.payment_method, 'Other') AS method, SUM(o.total)::text AS revenue, COUNT(*) AS orders
      FROM orders o WHERE ${paid(r)} GROUP BY 1 ORDER BY SUM(o.total) DESC`,
    prisma.$queryRaw<{ name: string; sku: string; revenue: string; qty: bigint; productId: number | null }[]>`
      SELECT oi.name, MAX(oi.sku) AS sku, MAX(oi.product_id) AS "productId", SUM(oi.total)::text AS revenue, SUM(oi.quantity) AS qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${paid(r)} GROUP BY oi.name ORDER BY SUM(oi.total) DESC LIMIT 50`,
  ]);
  const s = summary[0];
  const orders = Number(s.orders), revenue = Number(s.revenue);
  return {
    summary: { revenue, orders, average: orders ? revenue / orders : 0, discounts: Number(s.discounts), shipping: Number(s.shipping), items: Number(s.items) },
    months: months.map((m) => ({ month: m.month, revenue: Number(m.revenue), orders: Number(m.orders) })),
    categories: categories.map((c) => ({ category: c.category, revenue: Number(c.revenue), qty: Number(c.qty) })),
    payments: payments.map((p) => ({ method: p.method, revenue: Number(p.revenue), orders: Number(p.orders) })),
    products: products.map((p) => ({ name: p.name, sku: p.sku, productId: p.productId, revenue: Number(p.revenue), qty: Number(p.qty) })),
  };
}
export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
