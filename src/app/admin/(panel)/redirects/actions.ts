"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/guard";
const norm = (p: string) => { p = p.trim().replace(/^https?:\/\/[^/]+/, ""); if (!p.startsWith("/")) p = "/" + p; return p.split("?")[0]; };
export async function saveRedirect(fd: FormData) {
  await requireAdmin();
  const from = norm(String(fd.get("from") || "")); const toRaw = String(fd.get("to") || "").trim();
  if (from === "/" || !toRaw) redirect("/admin/redirects/?msg=Error%3A%20both%20paths%20are%20required");
  const to = /^https?:\/\//.test(toRaw) ? toRaw : norm(toRaw);
  await db.insert(s.redirects).values({ from, to, code: fd.get("code") === "302" ? 302 : 301 }).onDuplicateKeyUpdate({ set: { to, code: fd.get("code") === "302" ? 302 : 301 } });
  redirect("/admin/redirects/?msg=Redirect%20saved");
}
export async function deleteRedirect(fd: FormData) { await requireAdmin(); await db.delete(s.redirects).where(eq(s.redirects.id, Number(fd.get("id")))); redirect("/admin/redirects/?msg=Deleted"); }
