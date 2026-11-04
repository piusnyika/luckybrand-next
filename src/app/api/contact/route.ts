import { NextRequest, NextResponse } from "next/server";
import { sendMail, layout, escapeHtml } from "@/lib/mail";
import { getSite } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.website) return NextResponse.json({ ok: true }); // honeypot
  if (!(await rateLimit("contact:" + clientIp(req.headers), 5, 3600))) return NextResponse.json({ message: "Too many messages. Please try again later." }, { status: 429 });
  const name = String(b.name || "").trim().slice(0, 190), email = String(b.email || "").trim().slice(0, 190), message = String(b.message || "").trim().slice(0, 5000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return NextResponse.json({ message: "Please fill in your name, a valid email and a message." }, { status: 400 });
  const phone = String(b.phone || "").slice(0, 50), subject = String(b.subject || "").slice(0, 250);
  await prisma.contactMessage.create({ data: { name, email, phone, subject, message } });
  const site = await getSite();
  await sendMail(process.env.ADMIN_EMAIL || site.email, `[${site.name}] Contact: ${subject || name}`,
    await layout("New contact message", `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${phone ? ", " + escapeHtml(phone) : ""})</p><p><strong>${escapeHtml(subject)}</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`), email).catch(console.error);
  return NextResponse.json({ ok: true });
}
