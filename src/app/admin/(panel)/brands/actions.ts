"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function saveTerm(fd: FormData) {
  await requireStaff();
  const kind = fd.get("kind") === "tag" ? "tag" : "brand";
  const g = (k: string) => String(fd.get(k) ?? "").trim(); const id = Number(g("id")) || null; const name = g("name");
  if (!name) redirect("/admin/brands/?msg=Error%3A%20name%20required");
  let slug = slugify(g("slug") || name); let n = 2;
  const where = (slug: string) => (id ? { slug, id: { not: id } } : { slug });
  const taken = (slug: string) => kind === "tag" ? prisma.tag.findFirst({ where: where(slug), select: { id: true } }) : prisma.brand.findFirst({ where: where(slug), select: { id: true } });
  while (await taken(slug)) slug = `${slugify(g("slug") || name)}-${n++}`;
  if (kind === "tag") {
    if (id) await prisma.tag.update({ where: { id }, data: { name, slug } }); else await prisma.tag.create({ data: { name, slug } });
  } else {
    const data = { name, slug, image: g("image") || null, description: g("description") };
    if (id) await prisma.brand.update({ where: { id }, data }); else await prisma.brand.create({ data });
  }
  refreshStore(); redirect(`/admin/brands/?msg=${encodeURIComponent(`${kind === "tag" ? "Tag" : "Brand"} saved`)}`);
}
export async function deleteTerm(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  // product links go with it (ON DELETE CASCADE)
  if (fd.get("kind") === "tag") await prisma.tag.deleteMany({ where: { id } });
  else await prisma.brand.deleteMany({ where: { id } });
  refreshStore(); redirect("/admin/brands/?msg=Deleted");
}
