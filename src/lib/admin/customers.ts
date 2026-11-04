import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "../auth";

/**
 * Accounts `me` may block or delete: never yourself, shop managers only customers,
 * and never the last admin(s) that would remain unblocked.
 */
async function allowed(me: CurrentUser, ids: number[]) {
  const rows = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, blocked: true } }) : [];
  let ok = rows.filter((u) => u.id !== me.id && (me.role === "admin" || u.role === "customer"));
  const n = await prisma.user.count({ where: { role: "admin", blocked: false } });
  const adminsHit = ok.filter((u) => u.role === "admin" && !u.blocked).length;
  if (adminsHit && adminsHit >= Number(n)) ok = ok.filter((u) => u.role !== "admin");
  return { ids: ok.map((u) => u.id), skipped: ids.length - ok.length };
}

export async function setBlocked(me: CurrentUser, ids: number[], blocked: boolean) {
  const r = await allowed(me, ids);
  if (r.ids.length) await prisma.user.updateMany({ where: { id: { in: r.ids } }, data: { blocked, resetToken: null, resetExpires: null } });
  return { done: r.ids.length, skipped: r.skipped };
}

/** Permanent. Their orders stay (matched by email in the admin), just unlinked from the account. */
export async function deleteUsers(me: CurrentUser, ids: number[]) {
  const r = await allowed(me, ids);
  if (r.ids.length) await prisma.$transaction([
    prisma.order.updateMany({ where: { userId: { in: r.ids } }, data: { userId: null } }),
    prisma.user.deleteMany({ where: { id: { in: r.ids, not: me.id } } }),
  ]);
  return { done: r.ids.length, skipped: r.skipped };
}
