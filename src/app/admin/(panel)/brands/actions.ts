"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";

export async function saveTerm(fd: FormData) {
  await requireStaff();
  const kind = fd.get("kind") === "tag" ? "tag" : "brand"; const t = kind === "tag" ? s.tags : s.brands;
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null; const name = g("name");
  if (!name) redirect("/admin/brands/?msg=Error%3A%20name%20required");
  let slug = slugify(g("slug") || name); let n = 2;
  while ((await db.select({ id: t.id }).from(t).where(id ? and(eq(t.slug, slug), ne(t.id, id)) : eq(t.slug, slug))).length) slug = `${slugify(g("slug") || name)}-${n++}`;
  const data: any = { name, slug }; if (kind === "brand") { data.image = g("image") || null; data.description = g("description"); }
  if (id) await db.update(t).set(data).where(eq(t.id, id)); else await db.insert(t).values(data);
  refreshStore(); redirect(`/admin/brands/?msg=${encodeURIComponent(`${kind === "tag" ? "Tag" : "Brand"} saved`)}`);
}
export async function deleteTerm(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  if (fd.get("kind") === "tag") { await db.delete(s.productTags).where(eq(s.productTags.tagId, id)); await db.delete(s.tags).where(eq(s.tags.id, id)); }
  else { await db.delete(s.productBrands).where(eq(s.productBrands.brandId, id)); await db.delete(s.brands).where(eq(s.brands.id, id)); }
  refreshStore(); redirect("/admin/brands/?msg=Deleted");
}
