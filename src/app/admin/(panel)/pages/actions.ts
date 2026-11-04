"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const RESERVED = ["shop", "cart", "checkout", "my-account", "wishlist", "compare", "product", "product-category", "product-tag", "brand", "admin", "api", "uploads"];
export async function savePage(fd: FormData) {
  await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null;
  const title = g("title"); if (!title) redirect(`/admin/pages/${id ?? "new"}/?msg=Error%3A%20title%20required`);
  let slug = slugify(g("slug") || title); if (RESERVED.includes(slug)) slug += "-page";
  let n = 2; const base = slug;
  while (await prisma.page.findFirst({ where: id ? { slug, id: { not: id } } : { slug }, select: { id: true } })) slug = `${base}-${n++}`;
  const data = { title, slug, content: g("content"), published: g("published") === "1", seoTitle: g("seoTitle"), seoDescription: g("seoDescription") };
  let pid = id;
  if (id) await prisma.page.update({ where: { id }, data }); else pid = (await prisma.page.create({ data, select: { id: true } })).id;
  refreshStore(); redirect(`/admin/pages/${pid}/?msg=Page%20saved`);
}
export async function deletePage(fd: FormData) { await requireStaff(); await prisma.page.deleteMany({ where: { id: Number(fd.get("id")) } }); refreshStore(); redirect("/admin/pages/?msg=Page%20deleted"); }
