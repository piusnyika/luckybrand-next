import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/admin/media";
import { prisma } from "@/lib/prisma";

async function staff() { const u = await getCurrentUser(); return u && (u.role === "admin" || u.role === "manager"); }

export async function GET(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q") || ""; const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const where = q ? { OR: (["title", "url", "alt"] as const).map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) } : {};
  const [items, total] = await Promise.all([
    prisma.media.findMany({ where, orderBy: { id: "desc" }, take: 48, skip: (page - 1) * 48 }),
    prisma.media.count({ where }),
  ]);
  return NextResponse.json({ items, total: Number(total), pages: Math.ceil(Number(total) / 48) });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fd = await req.formData(); const out = [];
  try { for (const f of fd.getAll("files")) if (f instanceof File && f.size) out.push(await saveUpload(f)); }
  catch (e: any) { return NextResponse.json({ error: e.message, items: out }, { status: 400 }); }
  return NextResponse.json({ items: out });
}
