import "server-only";
import { db, schema as s } from "@/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { CurrentUser } from "../auth";

/**
 * Accounts `me` may block or delete: never yourself, shop managers only customers,
 * and never the last admin(s) that would remain unblocked.
 */
async function allowed(me: CurrentUser, ids: number[]) {
  const rows = ids.length ? await db.select({ id: s.users.id, role: s.users.role, blocked: s.users.blocked }).from(s.users).where(inArray(s.users.id, ids)) : [];
  let ok = rows.filter((u) => u.id !== me.id && (me.role === "admin" || u.role === "customer"));
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)` }).from(s.users).where(and(eq(s.users.role, "admin"), eq(s.users.blocked, false)));
  const adminsHit = ok.filter((u) => u.role === "admin" && !u.blocked).length;
  if (adminsHit && adminsHit >= Number(n)) ok = ok.filter((u) => u.role !== "admin");
  return { ids: ok.map((u) => u.id), skipped: ids.length - ok.length };
}

export async function setBlocked(me: CurrentUser, ids: number[], blocked: boolean) {
  const r = await allowed(me, ids);
  if (r.ids.length) await db.update(s.users).set({ blocked, resetToken: null, resetExpires: null }).where(inArray(s.users.id, r.ids));
  return { done: r.ids.length, skipped: r.skipped };
}

/** Permanent. Their orders stay (matched by email in the admin), just unlinked from the account. */
export async function deleteUsers(me: CurrentUser, ids: number[]) {
  const r = await allowed(me, ids);
  if (r.ids.length) await db.transaction(async (tx) => {
    await tx.update(s.orders).set({ userId: null }).where(inArray(s.orders.userId, r.ids));
    await tx.delete(s.users).where(and(inArray(s.users.id, r.ids), ne(s.users.id, me.id)));
  });
  return { done: r.ids.length, skipped: r.skipped };
}
