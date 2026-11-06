"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { moveTablesToSpec } from "@/lib/spec-tables";
import { prisma } from "@/lib/prisma";

/** back to the same list (tab, filters, page) after saving */
const backTo = (fd: FormData, msg: string) => {
  const qs = String(fd.get("qs") ?? "").replace(/(^|&)msg=[^&]*/g, "");
  const u = new URLSearchParams(qs); u.set("msg", msg);
  return `/admin/specifications/?${u}`;
};

export async function saveSpecification(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  const html = String(fd.get("specification") ?? "").trim();
  const empty = !html.replace(/<[^>]+>|&nbsp;|\s/g, "");
  const p = await prisma.product.update({ where: { id }, data: { specification: empty ? null : html }, select: { name: true } });
  refreshStore();
  redirect(backTo(fd, `Specifications saved: ${p.name}`));
}

export async function moveProductTables(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true, description: true, specification: true } });
  if (!p) redirect(backTo(fd, "Product not found"));
  const r = moveTablesToSpec(p.description, p.specification);
  await prisma.product.update({ where: { id }, data: { description: r.description, specification: r.specification } });
  refreshStore();
  redirect(backTo(fd, r.moved ? `Moved ${r.moved} table${r.moved === 1 ? "" : "s"} to Specifications: ${p.name}` : `Tidied the description of ${p.name}`));
}

/** Quick editor "copy from another product" */
export async function specificationOf(id: number): Promise<{ name: string; specification: string } | null> {
  await requireStaff();
  const p = await prisma.product.findUnique({ where: { id: Number(id) }, select: { name: true, specification: true } });
  return p ? { name: p.name, specification: p.specification ?? "" } : null;
}
