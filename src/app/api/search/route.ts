import { NextRequest, NextResponse } from "next/server";
import { searchSuggest } from "@/lib/catalog";
import { logSearch } from "@/lib/search";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Header search dropdown. Searches that find nothing at all are logged for Admin → Search (submitted searches are logged by the shop page). */
export async function GET(req: NextRequest) {
  // the dropdown hits this on every keystroke — be generous per-IP but still bounded, plus a site-wide cap
  if (!(await rateLimit("search:" + clientIp(req.headers), 120, 60)) || !(await rateLimit("search-all", 2000, 60))) {
    return NextResponse.json({ products: [], total: 0, partial: false, categories: [], brands: [] }, { status: 429 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 120);
  const r = await searchSuggest(q, 8);
  if (q.trim().length >= 3 && !r.products.length && !r.categories.length && !r.brands.length) await logSearch(q, 0);
  return NextResponse.json({
    products: r.products.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image, stock: p.stockStatus })),
    total: r.total, partial: r.partial, categories: r.categories, brands: r.brands,
  });
}
