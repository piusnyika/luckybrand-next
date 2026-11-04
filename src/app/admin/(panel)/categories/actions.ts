"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { descendantIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export async function saveCategory(fd: FormData) {
  await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null;
  const name = g("name"); if (!name) redirect("/admin/categories/?msg=Error%3A%20name%20required");
  let slug = slugify(g("slug") || name); let n = 2;
  while (await prisma.category.findFirst({ where: id ? { slug, id: { not: id } } : { slug }, select: { id: true } })) slug = `${slugify(g("slug") || name)}-${n++}`;
  let parentId = Number(g("parentId")) || null;
  if (id && parentId && (await descendantIds([id])).includes(parentId)) parentId = null; // no loops
  const data = { name, slug, parentId, description: g("description"), image: g("image") || null, sortOrder: Number(g("sortOrder") || 0), seoTitle: g("seoTitle"), seoDescription: g("seoDescription") };
  if (id) await prisma.category.update({ where: { id }, data }); else await prisma.category.create({ data });
  refreshStore();
  redirect(`/admin/categories/?msg=${encodeURIComponent("Category saved")}`);
}
export async function deleteCategory(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  const c = await prisma.category.findUnique({ where: { id } }); if (!c) return;
  // subcategories move up a level; product links go (CASCADE) and products lose it as main category (SET NULL)
  await prisma.$transaction([
    prisma.category.updateMany({ where: { parentId: id }, data: { parentId: c.parentId } }),
    prisma.category.delete({ where: { id } }),
  ]);
  refreshStore();
  redirect("/admin/categories/?msg=Category%20deleted");
}
