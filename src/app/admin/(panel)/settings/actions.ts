"use server";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin, refreshStore } from "@/lib/admin/guard";
import { ASSISTANT_MODELS, getSetting, saveSetting, getSite, type PaymentSettings } from "@/lib/settings";

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
    if (r.id && r.remove) await db.delete(s.shippingMethods).where(eq(s.shippingMethods.id, r.id));
    else if (r.id) await db.update(s.shippingMethods).set(data).where(eq(s.shippingMethods.id, r.id));
    else if (!r.remove) await db.insert(s.shippingMethods).values(data);
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
