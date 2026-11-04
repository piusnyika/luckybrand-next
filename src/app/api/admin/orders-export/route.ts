import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/format";
import { db, schema as s } from "@/db";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const p = req.nextUrl.searchParams; const where: SQL[] = [];
  if (p.get("status")) where.push(eq(s.orders.status, p.get("status") as any));
  if (p.get("from")) where.push(sql`${s.orders.createdAt} >= ${p.get("from")}`);
  if (p.get("to")) where.push(sql`${s.orders.createdAt} < DATE_ADD(${p.get("to")}, INTERVAL 1 DAY)`);
  const rows = await db.select({ o: s.orders, items: sql<string>`(SELECT GROUP_CONCAT(CONCAT(name, ' x', quantity) SEPARATOR '; ') FROM order_items WHERE order_id = ${s.orders.id})` })
    .from(s.orders).where(where.length ? and(...where) : undefined).orderBy(desc(s.orders.createdAt));
  const esc = csvCell;
  const head = ["Order", "Date", "Status", "First name", "Last name", "Email", "Phone", "City", "Items", "Subtotal", "Discount", "Shipping", "Total", "Payment", "Transaction"];
  const lines = rows.map(({ o, items }) => [o.number, o.createdAt.toISOString(), o.status, o.billing?.firstName, o.billing?.lastName, o.email, o.phone, o.billing?.city, items, o.subtotal, o.discountTotal, o.shippingTotal, o.total, o.paymentMethodTitle, o.transactionId].map(esc).join(","));
  return new Response([head.join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
