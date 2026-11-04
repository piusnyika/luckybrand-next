import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, schema as s } from "@/db";
import { desc, like, or, sql } from "drizzle-orm";
import { saveUpload } from "@/lib/admin/media";

async function staff() { const u = await getCurrentUser(); return u && (u.role === "admin" || u.role === "manager"); }

export async function GET(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q") || ""; const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const where = q ? or(like(s.media.title, `%${q}%`), like(s.media.url, `%${q}%`), like(s.media.alt, `%${q}%`)) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(s.media).where(where).orderBy(desc(s.media.id)).limit(48).offset((page - 1) * 48),
    db.select({ total: sql<number>`COUNT(*)` }).from(s.media).where(where),
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
