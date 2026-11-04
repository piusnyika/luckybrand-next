"use server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { escapeHtml, layout, mailButton, sendMail, staffEmails } from "@/lib/mail";
import { getSite } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export type QuoteState = { ok?: string; error?: string } | undefined;

export async function submitQuote(_: QuoteState, fd: FormData): Promise<QuoteState> {
  if (String(fd.get("website") || "")) return { ok: "Thank you! We'll get back to you shortly." };
  if (!(await rateLimit("quote:" + clientIp(await headers()), 5, 60 * 60))) return { error: "Too many requests from your connection. Please try again later or call us." };
  const user = await getCurrentUser();
  const g = (k: string, max = 191) => String(fd.get(k) || "").trim().slice(0, max);
  const name = g("name"), email = g("email").toLowerCase(), phone = g("phone", 50), company = g("company"), city = g("city", 120), message = g("message", 5000);
  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (phone.replace(/\D/g, "").length < 7) return { error: "Please enter a phone number so we can discuss your quote." };
  let wanted: { productId: number; qty: number }[] = [];
  try { wanted = (JSON.parse(String(fd.get("items") || "[]")) as { productId: number; qty: number }[]).slice(0, 50); } catch {}
  const ids = [...new Set(wanted.map((w) => Number(w.productId)).filter(Boolean))];
  const prods = ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, status: "published" }, select: { id: true, name: true, sku: true } }) : [];
  const items = prods.map((p) => ({ productId: p.id, name: p.name, sku: p.sku || "", qty: Math.max(1, Math.min(100000, Math.floor(Number(wanted.find((w) => Number(w.productId) === p.id)?.qty) || 1))) }));
  if (!items.length && message.length < 10) return { error: "Add at least one product, or tell us what you need in the message." };
  const q = await prisma.quoteRequest.create({ data: { name, email, phone, company, city, message, items, userId: user?.id ?? null } });

  const site = await getSite(); const base = process.env.SITE_URL || "";
  const list = items.length ? `<ul>${items.map((i) => `<li>${i.qty} × ${escapeHtml(i.name)}${i.sku ? ` (${escapeHtml(i.sku)})` : ""}</li>`).join("")}</ul>` : "";
  const to = await staffEmails();
  if (to.length) await sendMail(to.join(", "), `[${site.name}] Quote request #${q.id} from ${name}`, await layout(`Quote request #${q.id}`,
    `<p><strong>${escapeHtml(name)}</strong>${company ? `, ${escapeHtml(company)}` : ""}${city ? ` (${escapeHtml(city)})` : ""}<br>${escapeHtml(email)} · ${escapeHtml(phone)}</p>${list}
     ${message ? `<p style="white-space:pre-line">${escapeHtml(message)}</p>` : ""}${mailButton(`${base}/admin/quotes/${q.id}/`, "Open in admin")}`), email).catch((e) => console.error("quote mail:", e));
  await sendMail(email, `We received your quote request (#${q.id})`, await layout("Thanks for your quote request",
    `<p>Hi ${escapeHtml(name.split(" ")[0])},</p><p>We've received your request and will get back to you with prices and availability, usually within one working day.</p>${list}
     <p>Reference: <strong>#${q.id}</strong></p>`)).catch((e) => console.error("quote mail:", e));
  return { ok: `Thank you! Your request #${q.id} has been sent. We'll contact you at ${email} or ${phone}, usually within one working day.` };
}
