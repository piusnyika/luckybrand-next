import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportProductsCsv, templateCsv } from "@/lib/admin/product-csv";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const template = req.nextUrl.searchParams.has("template");
  const name = template ? "products-import-template.csv" : `products-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(template ? templateCsv() : await exportProductsCsv(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}
