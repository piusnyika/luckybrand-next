import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A logged-in customer's cart, kept on the server: restores it on another device and drives the abandoned-cart email.
// Guests get an empty cart / nothing is stored.
type Line = { id: number; qty: number; name: string; slug: string; price: number; image: string | null };
const clean = (v: unknown): Line[] => (Array.isArray(v) ? v : []).slice(0, 100).flatMap((l) => {
  const id = Number(l?.id), qty = Math.floor(Number(l?.qty));
  if (!id || !(qty > 0)) return [];
  return [{ id, qty: Math.min(qty, 999), name: String(l.name ?? "").slice(0, 255), slug: String(l.slug ?? "").slice(0, 191), price: Number(l.price) || 0, image: l.image ? String(l.image).slice(0, 512) : null }];
});

export async function GET() {
  const u = await getCurrentUser();
  const c = u ? await prisma.savedCart.findUnique({ where: { userId: u.id } }) : null;
  return NextResponse.json({ lines: clean(c?.lines) });
}

export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return new NextResponse(null, { status: 204 });
  const lines = clean((await req.json().catch(() => ({}))).lines);
  if (!lines.length) { await prisma.savedCart.deleteMany({ where: { userId: u.id } }); return new NextResponse(null, { status: 204 }); }
  const cur = await prisma.savedCart.findUnique({ where: { userId: u.id }, select: { lines: true } });
  const same = cur && JSON.stringify(clean(cur.lines).map((l) => [l.id, l.qty])) === JSON.stringify(lines.map((l) => [l.id, l.qty]));
  if (!same) await prisma.savedCart.upsert({ where: { userId: u.id }, create: { userId: u.id, lines }, update: { lines } });
  return new NextResponse(null, { status: 204 });
}
