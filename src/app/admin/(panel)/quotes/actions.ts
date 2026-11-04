"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/guard";
import { quoteCart, createOrder, addNote, getOrder } from "@/lib/orders";
import { escapeHtml, layout, mailButton, orderTable, sendMail } from "@/lib/mail";
import { getSite } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

const STATUSES = ["new", "quoted", "won", "lost"];
const back = (id: number, msg: string) => redirect(`/admin/quotes/${id}/?msg=${encodeURIComponent(msg)}`);

export async function saveQuote(fd: FormData) {
  await requireStaff(); const id = Number(fd.get("id"));
  const status = String(fd.get("status")); const staffNote = String(fd.get("staffNote") || "").slice(0, 5000);
  await prisma.quoteRequest.update({ where: { id }, data: { ...(STATUSES.includes(status) ? { status } : {}), staffNote } });
  back(id, "Saved");
}

/** Turns the request into a pending order at today's prices (stock is reserved, like any order) to adjust and send */
export async function quoteToOrder(fd: FormData) {
  const u = await requireStaff(); const id = Number(fd.get("id"));
  const q = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!q) redirect("/admin/quotes/");
  if (q.orderId) back(id, "Error: an order was already created for this request");
  const items = (q.items as { productId: number; qty: number }[]) ?? [];
  if (!items.length) back(id, "Error: this request has no products; create the order by hand");
  const quote = await quoteCart(items.map((i) => ({ id: i.productId, qty: i.qty })));
  if (!quote.lines.length) back(id, "Error: none of these products can be sold right now");
  const [firstName, ...rest] = q.name.split(" ");
  const order = await createOrder({
    quote, billing: { firstName, lastName: rest.join(" "), company: q.company, city: q.city, email: q.email, phone: q.phone, country: "ZW" }, shipping: null,
    email: q.email, phone: q.phone, note: q.message, paymentMethod: "quote", paymentMethodTitle: "Quote / invoice", userId: q.userId, ip: "",
  });
  await addNote(order.id, `Created from quote request #${q.id}.${quote.errors.length ? " Stock warnings: " + quote.errors.join(" ") : ""}`, false, u.displayName || u.email);
  await prisma.quoteRequest.update({ where: { id }, data: { orderId: order.id, status: "quoted" } });
  back(id, `Order #${order.number} created${quote.errors.length ? " (check the stock warnings)" : ""}`);
}

/** Emails the customer the quoted order with a link to view it */
export async function emailQuote(fd: FormData) {
  const u = await requireStaff(); const id = Number(fd.get("id"));
  const q = await prisma.quoteRequest.findUnique({ where: { id } });
  const o = q?.orderId ? await getOrder(q.orderId) : null;
  if (!q || !o) back(id, "Error: create the order first");
  const site = await getSite(); const base = process.env.SITE_URL || "";
  await sendMail(q!.email, `Your quote from ${site.name} (#${o!.number})`, await layout(`Your quote #${o!.number}`,
    `<p>Hi ${escapeHtml(q!.name.split(" ")[0])},</p><p>Thank you for your request. Here is our quote:</p>${orderTable(o!)}
     ${String(fd.get("message") || "").trim() ? `<p style="white-space:pre-line">${escapeHtml(String(fd.get("message")))}</p>` : ""}
     ${mailButton(`${base}/checkout/order-received/${o!.id}/?key=${o!.accessKey}`, "View your quote")}
     <p style="font-size:13px">To go ahead, reply to this email or call us. Prices are held for 7 days, subject to stock.</p>`), site.email || undefined);
  await addNote(o!.id, "Quote emailed to the customer.", false, u.displayName || u.email);
  back(id, `Quote emailed to ${q!.email}`);
}
