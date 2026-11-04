import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/format";
import { reportRange, salesReport } from "@/lib/admin/reports";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const r = reportRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const rep = await salesReport(r);
  const type = sp.get("type");
  const [head, rows]: [string[], (string | number)[][]] =
    type === "categories" ? [["Main category", "Items", "Sales"], rep.categories.map((c) => [c.category, c.qty, c.revenue.toFixed(2)])]
    : type === "payments" ? [["Payment method", "Orders", "Revenue"], rep.payments.map((p) => [p.method, p.orders, p.revenue.toFixed(2)])]
    : type === "products" ? [["Product", "SKU", "Sold", "Sales"], rep.products.map((p) => [p.name, p.sku, p.qty, p.revenue.toFixed(2)])]
    : [["Month", "Orders", "Revenue"], rep.months.map((m) => [m.month, m.orders, m.revenue.toFixed(2)])];
  const body = [head, ...rows].map((row) => row.map((v) => csvCell(String(v))).join(",")).join("\n");
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sales-${type || "months"}-${r.fromStr}-to-${r.toStr}.csv"` } });
}
