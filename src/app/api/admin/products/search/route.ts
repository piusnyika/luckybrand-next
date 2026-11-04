import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { effectivePrice } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

/** Admin product lookup by SKU or name (bundle editor). Excludes bundles and trashed products. */
export async function GET(req: NextRequest) {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);
  const rows = (await prisma.product.findMany({
    where: { status: { not: "trash" }, type: "simple", OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
    include: { image: { select: { url: true } } }, orderBy: { name: "asc" }, take: 12,
  })).map(({ image, ...p }) => ({ p, image: image?.url ?? null }));
  // exact SKU match first
  rows.sort((a, b) => Number(b.p.sku?.toLowerCase() === q.toLowerCase()) - Number(a.p.sku?.toLowerCase() === q.toLowerCase()));
  return NextResponse.json(rows.map(({ p, image }) => ({
    id: p.id, name: p.name, sku: p.sku || "", image: image ?? null, price: effectivePrice(p).price, status: p.status,
    stock: p.stockStatus === "outofstock" ? "Out of stock" : p.manageStock ? `${p.stockQty ?? 0} in stock` : p.stockStatus === "onbackorder" ? "Backorder" : "In stock",
  })));
}
