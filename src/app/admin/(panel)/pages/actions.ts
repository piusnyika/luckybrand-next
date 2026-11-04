"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";

const RESERVED = ["shop", "cart", "checkout", "my-account", "wishlist", "compare", "product", "product-category", "product-tag", "brand", "admin", "api", "uploads"];
export async function savePage(fd: FormData) {
  await requireStaff();
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null;
  const title = g("title"); if (!title) redirect(`/admin/pages/${id ?? "new"}/?msg=Error%3A%20title%20required`);
  let slug = slugify(g("slug") || title); if (RESERVED.includes(slug)) slug += "-page";
  let n = 2; const base = slug;
  while (await db.query.pages.findFirst({ where: id ? and(eq(s.pages.slug, slug), ne(s.pages.id, id)) : eq(s.pages.slug, slug) })) slug = `${base}-${n++}`;
  const data = { title, slug, content: g("content"), published: g("published") === "1", seoTitle: g("seoTitle"), seoDescription: g("seoDescription") };
  let pid = id;
  if (id) await db.update(s.pages).set(data).where(eq(s.pages.id, id)); else { const [r] = await db.insert(s.pages).values(data).$returningId(); pid = r.id; }
  refreshStore(); redirect(`/admin/pages/${pid}/?msg=Page%20saved`);
}
export async function deletePage(fd: FormData) { await requireStaff(); await db.delete(s.pages).where(eq(s.pages.id, Number(fd.get("id")))); refreshStore(); redirect("/admin/pages/?msg=Page%20deleted"); }
