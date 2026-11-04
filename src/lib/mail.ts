import "server-only";
import nodemailer from "nodemailer";
import { getSite } from "./settings";
import { getOrder, type FullOrder } from "./orders";
import { money, STATUS_LABEL } from "./format";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function tx() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST) return null;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, html: string, replyTo?: string) {
  const t = tx();
  if (!t) { console.log(`[mail disabled] to=${to} subject=${subject}`); return; }
  const site = await getSite();
  await t.sendMail({ from: process.env.MAIL_FROM || `"${site.name}" <${process.env.SMTP_USER}>`, to, subject, html, replyTo });
}

export async function layout(title: string, body: string) {
  const site = await getSite(); const base = process.env.SITE_URL || "";
  return `<!doctype html><html><body style="margin:0;background:#f8f9fa;font-family:Arial,Helvetica,sans-serif;color:#1b1f22">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #dfe2e6">
  <tr><td style="background:#004798;padding:24px 32px"><img src="${base}${site.logoWhite || site.logo}" alt="${site.name}" height="36" style="background:#fff;padding:6px;border-radius:6px"></td></tr>
  <tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px">${title}</h1>${body}</td></tr>
  <tr><td style="padding:20px 32px;background:#f8f9fa;font-size:12px;color:#5b5d67">${site.name} · ${site.address}<br>${site.phones.map((p) => p.label).slice(0, 2).join(" · ")}</td></tr>
  </table></td></tr></table></body></html>`;
}

export function orderTable(o: FullOrder) {
  const row = (a: string, b: string, bold = false) => `<tr><td style="padding:8px;border:1px solid #dfe2e6;${bold ? "font-weight:bold" : ""}">${a}</td><td style="padding:8px;border:1px solid #dfe2e6;text-align:right;${bold ? "font-weight:bold" : ""}">${b}</td></tr>`;
  const b = o.billing || {};
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0">
    <tr><th style="padding:8px;border:1px solid #dfe2e6;text-align:left">Product</th><th style="padding:8px;border:1px solid #dfe2e6;text-align:right">Total</th></tr>
    ${o.items.map((i) => row(`${i.name} × ${i.quantity}${i.bundle?.length ? `<br><small style="color:#737582">Includes: ${i.bundle.map((b) => `${b.qty * i.quantity} × ${escapeHtml(b.name)}`).join(", ")}</small>` : ""}`, money(i.total))).join("")}
    ${row("Subtotal:", money(o.subtotal))}
    ${Number(o.discountTotal) > 0 ? row(`Discount${o.couponCode ? ` (${o.couponCode})` : ""}:`, "-" + money(o.discountTotal)) : ""}
    ${row("Shipping:", o.shippingMethod ? `${Number(o.shippingTotal) > 0 ? money(o.shippingTotal) : "Free"} <small>(${o.shippingMethod})</small>` : money(o.shippingTotal))}
    ${row("Payment method:", o.paymentMethodTitle)}
    ${row("Total:", money(o.total), true)}
  </table>
  <h3 style="font-size:16px;margin:20px 0 8px">Billing address</h3>
  <p style="font-size:14px;line-height:1.6;margin:0">${[`${b.firstName ?? ""} ${b.lastName ?? ""}`, b.company, b.address1, b.address2, b.city, b.state, b.country].filter(Boolean).map((x) => escapeHtml(String(x))).join("<br>")}<br>${escapeHtml(o.phone)}<br>${escapeHtml(o.email)}</p>
  ${o.customerNote ? `<p style="font-size:14px"><strong>Note:</strong> ${escapeHtml(o.customerNote)}</p>` : ""}`;
}
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Customer and admin emails on status transitions */
export async function sendOrderEmails(orderId: number, status: string, previous: string | null) {
  const o = await getOrder(orderId); if (!o) return;
  const site = await getSite();
  const admin = process.env.ADMIN_EMAIL || site.email;
  const base = process.env.SITE_URL || "";
  const viewUrl = `${base}/checkout/order-received/${o.id}/?key=${o.accessKey}`;
  const name = escapeHtml(o.billing?.firstName || "there");
  const isNew = previous === null || previous === "pending" || previous === "failed";

  if (isNew && ["processing", "on-hold"].includes(status)) {
    await sendMail(admin, `[${site.name}] New order #${o.number}`, await layout(`New order: #${o.number}`,
      `<p>You’ve received the following order from ${escapeHtml(`${o.billing?.firstName ?? ""} ${o.billing?.lastName ?? ""}`)}:</p>${orderTable(o)}<p><a href="${base}/admin/orders/${o.id}/">View in admin</a></p>`), o.email);
    await sendMail(o.email, `Your ${site.name} order has been received!`, await layout("Thank you for your order",
      `<p>Hi ${name},</p><p>${status === "on-hold" ? "Your order is on hold until we confirm payment has been received." : "We have finished processing your payment and your order is now being prepared."}</p>
       <p><strong>Order #${o.number}</strong></p>${orderTable(o)}<p><a href="${viewUrl}" style="color:#004798">View your order</a></p>`));
  } else if (status === "completed") {
    await sendMail(o.email, `Your ${site.name} order is now complete`, await layout("Thanks for shopping with us",
      `<p>Hi ${name},</p><p>We have finished processing your order #${o.number}.</p>${orderTable(o)}`));
  } else if (status === "cancelled" || status === "failed" || status === "refunded") {
    await sendMail(admin, `[${site.name}] Order #${o.number} ${STATUS_LABEL[status].toLowerCase()}`, await layout(`Order #${o.number} ${STATUS_LABEL[status].toLowerCase()}`, orderTable(o)));
    if (status !== "failed") await sendMail(o.email, `Your ${site.name} order #${o.number} has been ${status}`, await layout(`Order ${status}`, `<p>Hi ${name},</p><p>Your order #${o.number} has been ${status}.</p>${orderTable(o)}`));
  }
}
