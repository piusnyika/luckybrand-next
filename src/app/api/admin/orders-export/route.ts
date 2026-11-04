import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const p = req.nextUrl.searchParams;
  const day = (v: string | null, add = 0) => { const d = v ? new Date(v + "T00:00:00Z") : null; return d && !isNaN(d.getTime()) ? new Date(d.getTime() + add * 86_400_000) : undefined; };
  const from = day(p.get("from")), to = day(p.get("to"), 1);
  const rows = (await prisma.order.findMany({
    where: { ...(p.get("status") ? { status: p.get("status")! } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) },
    orderBy: { createdAt: "desc" }, include: { items: { select: { name: true, quantity: true }, orderBy: { id: "asc" } } },
  })).map(({ items, ...o }) => ({ o, items: items.map((i) => `${i.name} x${i.quantity}`).join("; ") }));
  const esc = csvCell;
  const head = ["Order", "Date", "Status", "First name", "Last name", "Email", "Phone", "City", "Items", "Subtotal", "Discount", "Shipping", "Total", "Payment", "Transaction"];
  const lines = rows.map(({ o, items }) => [o.number, o.createdAt.toISOString(), o.status, o.billing?.firstName, o.billing?.lastName, o.email, o.phone, o.billing?.city, items, o.subtotal, o.discountTotal, o.shippingTotal, o.total, o.paymentMethodTitle, o.transactionId].map(esc).join(","));
  return new Response([head.join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
