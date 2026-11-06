"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/guard";
import { setOrderStatus, addNote, getOrder } from "@/lib/orders";
import { ORDER_STATUSES } from "@/lib/format";
import { sendMail, sendCustomerMail, layout, orderTable } from "@/lib/mail";
import { getSite } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function updateOrder(fd: FormData) {
  const u = await requireStaff(); const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as (typeof ORDER_STATUSES)[number];
  const o = await getOrder(id); if (!o) return;
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const billing = { ...o.billing, firstName: g("b_firstName"), lastName: g("b_lastName"), company: g("b_company"), address1: g("b_address1"), address2: g("b_address2"), city: g("b_city"), state: g("b_state") };
  await prisma.order.update({ where: { id }, data: { billing, email: g("email") || o.email, phone: g("phone"), transactionId: g("transactionId") } });
  if (ORDER_STATUSES.includes(status) && status !== o.status) await setOrderStatus(id, status, u.displayName || u.email);
  revalidatePath(`/admin/orders/${id}/`);
  redirect(`/admin/orders/${id}/?msg=Order%20updated`);
}

export async function addOrderNote(fd: FormData) {
  const u = await requireStaff(); const id = Number(fd.get("id"));
  const content = String(fd.get("note") || "").trim(); const isCustomer = fd.get("type") === "customer";
  if (content) {
    await addNote(id, content, isCustomer, u.displayName || u.email);
    if (isCustomer) {
      const o = await getOrder(id); const site = await getSite();
      if (o) await sendCustomerMail(o.email, `Note added to your ${site.name} order #${o.number}`, await layout("A note has been added to your order", `<p>Hi ${o.billing?.firstName ?? ""},</p><blockquote style="border-left:3px solid #004798;margin:0;padding:8px 16px;background:#f8f9fa">${content.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</blockquote>${orderTable(o)}`)).catch(console.error);
    }
  }
  redirect(`/admin/orders/${id}/?msg=Note%20added`);
}

export async function resendEmail(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  const o = await getOrder(id); if (!o) return; const site = await getSite();
  await sendCustomerMail(o.email, `Your ${site.name} order #${o.number}`, await layout(`Order #${o.number}`, `<p>Hi ${o.billing?.firstName ?? ""}, here are the details of your order.</p>${orderTable(o)}`));
  await addNote(id, "Order details emailed to customer.", false, "system");
  redirect(`/admin/orders/${id}/?msg=Email%20sent`);
}

export async function bulkOrders(fd: FormData) {
  const u = await requireStaff();
  const sel = fd.getAll("sel").map(Number).filter(Boolean); const action = String(fd.get("bulk") || "");
  if (action === "delete") {
    if (u.role !== "admin") redirect("/admin/orders/?msg=Error%3A%20only%20admins%20can%20delete%20orders");
    await prisma.order.deleteMany({ where: { id: { in: sel } } }); // items and notes go with them (ON DELETE CASCADE)
  } else if ((ORDER_STATUSES as readonly string[]).includes(action)) {
    for (const id of sel) await setOrderStatus(id, action as (typeof ORDER_STATUSES)[number], u.displayName || u.email);
  }
  redirect(`/admin/orders/?msg=${encodeURIComponent(`${sel.length} order(s) updated`)}`);
}
