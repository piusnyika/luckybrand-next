import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/format";
import { db, schema as s } from "@/db";
import { desc } from "drizzle-orm";
export async function GET() {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const rows = await db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt));
  return new Response(["email,subscribed", ...rows.map((r) => `${csvCell(r.email)},${r.createdAt.toISOString()}`)].join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="subscribers.csv"' } });
}
