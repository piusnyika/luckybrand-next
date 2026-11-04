"use server";
import { redirect } from "next/navigation";
import { requireAdmin, refreshStore } from "@/lib/admin/guard";
import { ASSISTANT_MODELS, getSetting, saveSetting, getSite, type NotificationSettings, type PaymentSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

const g = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const done = (tab: string) => { refreshStore(); redirect(`/admin/settings/?tab=${tab}&msg=Settings%20saved`); };

export async function saveGeneral(fd: FormData) {
  await requireAdmin(); const site = await getSite();
  await saveSetting("site", {
    ...site, name: g(fd, "name"), tagline: g(fd, "tagline"), logo: g(fd, "logo") || site.logo, logoWhite: g(fd, "logoWhite") || null, favicon: g(fd, "favicon") || null,
    email: g(fd, "email"), address: g(fd, "address"), hours: lines(g(fd, "hours")),
    phones: lines(g(fd, "phones")).map((l) => ({ label: l, tel: l.replace(/\(.*\)/, "").replace(/[^\d+]/g, "") })),
    whatsapp: g(fd, "whatsapp"), orderOnWhatsapp: fd.get("orderOnWhatsapp") === "on",
    seoTitle: g(fd, "seoTitle"), seoDescription: g(fd, "seoDescription"),
  });
  done("general");
}
export async function saveAppearance(fd: FormData) {
  await requireAdmin(); const site = await getSite();
  const social = lines(g(fd, "social")).map((l) => { const [icon, url] = l.split(/\s+/, 2); return { icon: icon.toLowerCase(), url }; }).filter((x) => x.url);
  const footerColumns = lines(g(fd, "footerColumns")).map((l) => { const [title, menu] = l.split("|").map((x) => x.trim()); return { title, menu }; }).filter((x) => x.menu);
  await saveSetting("site", {
    ...site, noticeEnabled: fd.get("noticeEnabled") === "on", noticeHtml: g(fd, "noticeHtml"), noticeBg: g(fd, "noticeBg") || "#ed1b24",
    newsletterTitle: g(fd, "newsletterTitle"), newsletterSubtitle: g(fd, "newsletterSubtitle"), copyright: g(fd, "copyright"), marketingNote: g(fd, "marketingNote"),
    social, footerColumns,
    freeShippingThreshold: g(fd, "freeShippingThreshold") ? Number(g(fd, "freeShippingThreshold")) : null, freeShippingMessage: g(fd, "freeShippingMessage"), freeShippingSuccess: g(fd, "freeShippingSuccess"),
  });
  done("appearance");
}
export async function savePayments(fd: FormData) {
  await requireAdmin(); const cur = await getSetting<PaymentSettings>("payments");
  const pm = (k: "paynow" | "cod" | "bacs" | "ngenius") => ({ ...cur[k], enabled: fd.get(`${k}_enabled`) === "on", title: g(fd, `${k}_title`) || cur[k].title, description: g(fd, `${k}_description`) });
  await saveSetting("payments", { paynow: { ...pm("paynow"), mobile: fd.get("paynow_mobile") === "on" }, cod: pm("cod"), bacs: { ...pm("bacs"), details: g(fd, "bacs_details") }, ngenius: pm("ngenius") });
  done("payments");
}
export async function saveShipping(fd: FormData) {
  await requireAdmin();
  const rows: { id?: number; name: string; type: "free" | "flat" | "pickup"; cost: string; minAmount: string; note: string; enabled: boolean; remove?: boolean }[] = JSON.parse(g(fd, "methods") || "[]");
  for (const [i, r] of rows.entries()) {
    const data = { name: r.name || "Shipping", type: r.type, cost: String(Number(r.cost || 0)), minAmount: r.minAmount ? String(Number(r.minAmount)) : null, note: r.note || "", enabled: r.enabled, sortOrder: i };
    if (r.id && r.remove) await prisma.shippingMethod.deleteMany({ where: { id: r.id } });
    else if (r.id) await prisma.shippingMethod.updateMany({ where: { id: r.id }, data });
    else if (!r.remove) await prisma.shippingMethod.create({ data });
  }
  done("shipping");
}
export async function saveContact(fd: FormData) {
  await requireAdmin(); const cur: any = await getSetting("contact");
  const blocks = [0, 1, 2, 3, 4, 5].map((i) => ({ title: g(fd, `b${i}_title`), html: g(fd, `b${i}_html`).replace(/\r?\n/g, "<br>") })).filter((b) => b.title);
  await saveSetting("contact", { ...cur, heading: g(fd, "heading"), subheading: g(fd, "subheading"), mapQuery: g(fd, "mapQuery"), formTitle: g(fd, "formTitle"), formIntro: g(fd, "formIntro"), blocks,
    social: lines(g(fd, "social")).map((l) => { const [icon, url] = l.split(/\s+/, 2); return { icon: icon.toLowerCase(), url }; }).filter((x) => x.url) });
  done("contact");
}
export async function saveNotifications(fd: FormData) {
  await requireAdmin();
  const on = (k: string) => fd.get(k) === "on";
  await saveSetting("notifications", {
    staffEmails: lines(g(fd, "staffEmails")).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    lowStock: on("lowStock"), backInStock: on("backInStock"), abandonedCart: on("abandonedCart"),
    abandonedCartHours: Math.min(72, Math.max(1, Math.round(Number(g(fd, "abandonedCartHours")) || 3))),
    whatsapp: on("whatsapp"), whatsappTo: lines(g(fd, "whatsappTo")).filter((n) => n.replace(/\D/g, "").length >= 9),
    whatsappTemplate: g(fd, "whatsappTemplate").replace(/[^a-z0-9_]/gi, "").toLowerCase() || "new_order_alert", whatsappLanguage: g(fd, "whatsappLanguage") || "en",
  } satisfies NotificationSettings);
  done("notifications");
}

export async function testWhatsApp() {
  await requireAdmin();
  const n = await getSetting<NotificationSettings>("notifications");
  const { sendWhatsAppTemplate, whatsappConfigured } = await import("@/lib/whatsapp");
  let msg = "Test message sent";
  if (!whatsappConfigured()) msg = "Error: WhatsApp is not connected on the server (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)";
  else if (!n.whatsappTo.length) msg = "Error: add a staff WhatsApp number and save first";
  else await sendWhatsAppTemplate(n.whatsappTo[0], n.whatsappTemplate, n.whatsappLanguage, ["#TEST", "Test Customer", "$1.00"]).catch((e) => { msg = "Error: " + (e as Error).message; });
  redirect(`/admin/settings/?tab=notifications&msg=${encodeURIComponent(msg)}`);
}

export async function saveIntegrations(fd: FormData) {
  await requireAdmin(); const site = await getSite();
  const salesContacts = lines(g(fd, "salesContacts")).map((l) => { const [name, role, phone] = l.split("|").map((x) => x.trim()); return { name, role: role || "Sales", phone: (phone || "").replace(/[^\d+]/g, "") }; }).filter((c) => c.name && c.phone);
  await saveSetting("site", { ...site, gaMeasurementId: g(fd, "gaMeasurementId"), tawkPropertyId: g(fd, "tawkPropertyId"), tawkWidgetId: g(fd, "tawkWidgetId"),
    chatEnabled: fd.get("chatEnabled") === "on", assistantEnabled: fd.get("assistantEnabled") === "on", salesContacts,
    assistantModel: ASSISTANT_MODELS.some((m) => m.id === g(fd, "assistantModel")) ? g(fd, "assistantModel") : site.assistantModel,
    assistantName: g(fd, "assistantName") || site.assistantName, assistantGreeting: g(fd, "assistantGreeting") || site.assistantGreeting,
    assistantDailyLimit: Math.max(0, Number(g(fd, "assistantDailyLimit")) || 0) });
  done("integrations");
}
