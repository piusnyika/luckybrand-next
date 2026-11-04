"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { requireStaff } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/password";
import { setBlocked, deleteUsers } from "@/lib/admin/customers";

const skippedMsg = (n: number) => (n ? ` (${n} skipped: you can't change your own account, shop managers can only manage customers, and the last admin must stay)` : "");

export async function blockCustomer(fd: FormData) {
  const me = await requireStaff(); const id = Number(fd.get("id")); const block = fd.get("block") === "1";
  const r = await setBlocked(me, [id], block);
  redirect(`/admin/customers/${id}/?msg=${encodeURIComponent(r.done ? (block ? "Account blocked" : "Account unblocked") : "Error: you can't change this account" + skippedMsg(r.skipped))}`);
}

export async function deleteCustomer(fd: FormData) {
  const me = await requireStaff(); const id = Number(fd.get("id"));
  const r = await deleteUsers(me, [id]);
  if (!r.done) redirect(`/admin/customers/${id}/?msg=${encodeURIComponent("Error: you can't delete this account" + skippedMsg(r.skipped))}`);
  redirect(`/admin/customers/?msg=${encodeURIComponent("Customer deleted. Their orders were kept.")}`);
}

export async function bulkCustomers(fd: FormData) {
  const me = await requireStaff();
  const sel = fd.getAll("sel").map(Number).filter(Boolean); const action = String(fd.get("bulk") || ""); const qs = String(fd.get("qs") || "");
  let msg = "Nothing selected";
  if (sel.length && (action === "block" || action === "unblock")) { const r = await setBlocked(me, sel, action === "block"); msg = `${r.done} account(s) ${action}ed${skippedMsg(r.skipped)}`; }
  if (sel.length && action === "delete") { const r = await deleteUsers(me, sel); msg = `${r.done} account(s) deleted, orders kept${skippedMsg(r.skipped)}`; }
  redirect(`/admin/customers/?${qs}${qs ? "&" : ""}msg=${encodeURIComponent(msg)}`);
}

export async function saveCustomer(fd: FormData) {
  const me = await requireStaff(); const id = Number(fd.get("id"));
  const target = await db.query.users.findFirst({ columns: { role: true, sessionVersion: true }, where: eq(s.users.id, id) });
  if (!target || (me.role !== "admin" && target.role !== "customer")) redirect(`/admin/customers/${id}/?msg=${encodeURIComponent("Error: shop managers can only edit customers")}`);
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const email = g("email").toLowerCase();
  if (await db.query.users.findFirst({ where: and(eq(s.users.email, email), ne(s.users.id, id)) })) redirect(`/admin/customers/${id}/?msg=Error%3A%20email%20already%20used`);
  const patch: Partial<typeof s.users.$inferInsert> = {
    firstName: g("firstName"), lastName: g("lastName"), email, phone: g("phone"),
    billing: { firstName: g("firstName"), lastName: g("lastName"), company: g("company"), address1: g("address1"), address2: g("address2"), city: g("city"), state: g("state"), country: "ZW", phone: g("phone"), email },
  };
  if (me.role === "admin" && ["admin", "manager", "customer"].includes(g("role")) && id !== me.id) patch.role = g("role") as "admin" | "manager" | "customer";
  if (g("password")) { if (g("password").length < 8) redirect(`/admin/customers/${id}/?msg=Error%3A%20password%20too%20short`); patch.passwordHash = await hashPassword(g("password")); patch.sessionVersion = target!.sessionVersion + 1; }
  await db.update(s.users).set(patch).where(eq(s.users.id, id));
  redirect(`/admin/customers/${id}/?msg=Customer%20saved`);
}
