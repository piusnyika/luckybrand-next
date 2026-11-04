import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, like, ne, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, schema as s } from "@/db";
import { effectivePrice } from "@/lib/catalog";

/** Admin product lookup by SKU or name (bundle editor). Excludes bundles and trashed products. */
export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);
  const rows = await db.select({ p: s.products, image: s.media.url }).from(s.products).leftJoin(s.media, eq(s.media.id, s.products.imageId))
    .where(and(ne(s.products.status, "trash"), eq(s.products.type, "simple"), or(eq(s.products.sku, q), like(s.products.sku, `%${q}%`), like(s.products.name, `%${q}%`))))
    .orderBy(asc(s.products.name)).limit(12);
  // exact SKU match first
  rows.sort((a, b) => Number(b.p.sku?.toLowerCase() === q.toLowerCase()) - Number(a.p.sku?.toLowerCase() === q.toLowerCase()));
  return NextResponse.json(rows.map(({ p, image }) => ({
    id: p.id, name: p.name, sku: p.sku || "", image: image ?? null, price: effectivePrice(p).price, status: p.status,
    stock: p.stockStatus === "outofstock" ? "Out of stock" : p.manageStock ? `${p.stockQty ?? 0} in stock` : p.stockStatus === "onbackorder" ? "Backorder" : "In stock",
  })));
}
