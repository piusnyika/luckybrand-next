import { NextRequest, NextResponse } from "next/server";
import { getCards, productRelations } from "@/lib/catalog";
import { db, schema as s } from "@/db";
import { inArray } from "drizzle-orm";
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map(Number).filter(Boolean).slice(0, 60);
  const cards = await getCards(ids);
  if (req.nextUrl.searchParams.get("full")) {
    const extra = ids.length ? await db.select({ id: s.products.id, attributes: s.products.attributes, weight: s.products.weight, shortDescription: s.products.shortDescription }).from(s.products).where(inArray(s.products.id, ids)) : [];
    const brands = await Promise.all(cards.map((c) => productRelations(c.id)));
    return NextResponse.json(cards.map((c, i) => ({ ...c, ...extra.find((e) => e.id === c.id), brand: brands[i].brandList[0]?.name ?? "", categories: brands[i].categoryList.map((x) => x.name) })));
  }
  return NextResponse.json(cards);
}
