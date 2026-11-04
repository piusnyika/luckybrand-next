import { NextRequest, NextResponse } from "next/server";
import { interpret } from "@/lib/paynow";
import { getOrder } from "@/lib/orders";
import { applyPaynowStatus } from "@/lib/paynow-apply";

/** Paynow server-to-server status notifications (resulturl) */
export async function POST(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("order"));
  const body = await req.text();
  const r = interpret(body);
  if (!r) return new NextResponse("bad hash", { status: 400 });
  const o = await getOrder(id);
  if (!o || o.number !== r.reference) return new NextResponse("unknown order", { status: 404 });
  await applyPaynowStatus(o.id, o.status, r);
  return new NextResponse("ok");
}

