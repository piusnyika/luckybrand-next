import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/format";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const u = await getCurrentUser(); if (!u || u.role === "customer") return new Response("forbidden", { status: 403 });
  const rows = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  return new Response(["email,subscribed", ...rows.map((r) => `${csvCell(r.email)},${r.createdAt.toISOString()}`)].join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="subscribers.csv"' } });
}
