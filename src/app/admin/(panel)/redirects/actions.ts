"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
const norm = (p: string) => { p = p.trim().replace(/^https?:\/\/[^/]+/, ""); if (!p.startsWith("/")) p = "/" + p; return p.split("?")[0]; };
export async function saveRedirect(fd: FormData) {
  await requireAdmin();
  const from = norm(String(fd.get("from") || "")); const toRaw = String(fd.get("to") || "").trim();
  if (from === "/" || !toRaw) redirect("/admin/redirects/?msg=Error%3A%20both%20paths%20are%20required");
  const to = /^https?:\/\//.test(toRaw) ? toRaw : norm(toRaw);
  const code = fd.get("code") === "302" ? 302 : 301;
  await prisma.redirect.upsert({ where: { from }, create: { from, to, code }, update: { to, code } });
  redirect("/admin/redirects/?msg=Redirect%20saved");
}
export async function deleteRedirect(fd: FormData) { await requireAdmin(); await prisma.redirect.deleteMany({ where: { id: Number(fd.get("id")) } }); redirect("/admin/redirects/?msg=Deleted"); }
