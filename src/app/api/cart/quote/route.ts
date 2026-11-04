import { NextRequest, NextResponse } from "next/server";
import { quoteCart } from "@/lib/orders";
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const lines = Array.isArray(b.lines) ? b.lines.slice(0, 100) : [];
  return NextResponse.json(await quoteCart(lines, b.coupon || null, b.shippingMethodId ?? null));
}
