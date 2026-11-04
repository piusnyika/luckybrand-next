"use server";
import { redirect } from "next/navigation";
import { requireStaff, refreshStore } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

type Item = { key: string; label: string; url: string; parentKey: string | null };
export async function saveMenu(fd: FormData) {
  await requireStaff();
  const menu = String(fd.get("menu")); const items: Item[] = JSON.parse(String(fd.get("items") || "[]"));
  await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { menu } });
    const ids = new Map<string, number>();
    for (const [i, it] of items.entries()) {
      if (!it.label.trim()) continue;
      const r = await tx.menuItem.create({ data: { menu, label: it.label.trim(), url: it.url.trim() || "/", position: i, parentId: it.parentKey ? ids.get(it.parentKey) ?? null : null }, select: { id: true } });
      ids.set(it.key, r.id);
    }
  });
  refreshStore(); redirect(`/admin/menus/?menu=${encodeURIComponent(menu)}&msg=Menu%20saved`);
}
