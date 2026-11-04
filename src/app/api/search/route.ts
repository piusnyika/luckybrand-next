import { NextRequest, NextResponse } from "next/server";
import { searchSuggest } from "@/lib/catalog";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const items = await searchSuggest(q, 8);
  return NextResponse.json(items.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image })));
}
