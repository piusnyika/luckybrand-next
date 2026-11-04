"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { descendantIds } from "@/lib/catalog";

export async function saveCategory(fd: FormData) {
  await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null;
  const name = g("name"); if (!name) redirect("/admin/categories/?msg=Error%3A%20name%20required");
  let slug = slugify(g("slug") || name); let n = 2;
  while (await db.query.categories.findFirst({ where: id ? and(eq(s.categories.slug, slug), ne(s.categories.id, id)) : eq(s.categories.slug, slug) })) slug = `${slugify(g("slug") || name)}-${n++}`;
  let parentId = Number(g("parentId")) || null;
  if (id && parentId && (await descendantIds([id])).includes(parentId)) parentId = null; // no loops
  const data = { name, slug, parentId, description: g("description"), image: g("image") || null, sortOrder: Number(g("sortOrder") || 0), seoTitle: g("seoTitle"), seoDescription: g("seoDescription") };
  if (id) await db.update(s.categories).set(data).where(eq(s.categories.id, id)); else await db.insert(s.categories).values(data);
  refreshStore();
  redirect(`/admin/categories/?msg=${encodeURIComponent("Category saved")}`);
}
export async function deleteCategory(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  const c = await db.query.categories.findFirst({ where: eq(s.categories.id, id) }); if (!c) return;
  await db.update(s.categories).set({ parentId: c.parentId }).where(eq(s.categories.parentId, id));
  await db.delete(s.productCategories).where(eq(s.productCategories.categoryId, id));
  await db.update(s.products).set({ primaryCategoryId: null }).where(eq(s.products.primaryCategoryId, id));
  await db.delete(s.categories).where(eq(s.categories.id, id));
  refreshStore();
  redirect("/admin/categories/?msg=Category%20deleted");
}
