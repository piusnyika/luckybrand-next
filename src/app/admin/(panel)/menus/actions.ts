"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { requireStaff, refreshStore } from "@/lib/admin/guard";

type Item = { key: string; label: string; url: string; parentKey: string | null };
export async function saveMenu(fd: FormData) {
  await requireStaff();
  const menu = String(fd.get("menu")); const items: Item[] = JSON.parse(String(fd.get("items") || "[]"));
  await db.transaction(async (tx) => {
    await tx.delete(s.menuItems).where(eq(s.menuItems.menu, menu));
    const ids = new Map<string, number>();
    for (const [i, it] of items.entries()) {
      if (!it.label.trim()) continue;
      const [r] = await tx.insert(s.menuItems).values({ menu, label: it.label.trim(), url: it.url.trim() || "/", position: i, parentId: it.parentKey ? ids.get(it.parentKey) ?? null : null }).$returningId();
      ids.set(it.key, r.id);
    }
  });
  refreshStore(); redirect(`/admin/menus/?menu=${encodeURIComponent(menu)}&msg=Menu%20saved`);
}
