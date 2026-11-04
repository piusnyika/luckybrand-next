import { cache } from "react";
import { prisma, type Prisma } from "@/lib/prisma";

export type SiteSettings = {
  name: string; tagline: string; logo: string; logoWhite?: string | null; favicon?: string | null;
  noticeEnabled: boolean; noticeHtml: string; noticeBg: string;
  primaryColor: string; secondaryColor: string; currency: string; currencySymbol: string;
  whatsapp: string; orderOnWhatsapp: boolean; shareNetworks: string[];
  address: string; email: string; hours: string[]; phones: { label: string; tel: string }[];
  social: { icon: string; url: string }[]; copyright: string; marketingNote: string;
  footerColumns: { title: string; menu: string }[];
  newsletterTitle: string; newsletterSubtitle: string;
  freeShippingThreshold: number | null; freeShippingMessage: string; freeShippingSuccess: string;
  tawkPropertyId: string; tawkWidgetId: string; gaMeasurementId: string; recaptchaSiteKey: string;
  seoTitle: string; seoDescription: string;
  chatEnabled: boolean; assistantEnabled: boolean; assistantModel: string; assistantName: string; assistantGreeting: string; assistantDailyLimit: number;
  /** null until saved in the admin: the named numbers under Phone numbers are used instead */
  salesContacts: SalesContact[] | null;
};
export type SalesContact = { name: string; role: string; phone: string };

/** Claude models offered for the AI assistant, most capable first */
export const ASSISTANT_MODELS = [
  { id: "claude-fable-5-1", label: "Claude Fable 5.1: most capable, highest cost ($10 / $50 per million tokens in / out)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5: very capable ($4 / $20)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5: balanced ($2 / $10)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5: fastest, lowest cost ($0.10 / $0.50)" },
] as const;

export const assistantAvailable = (site: SiteSettings) => site.assistantEnabled && !!process.env.ANTHROPIC_API_KEY;

/** The people customers can pick on WhatsApp: saved contacts, otherwise the named phone numbers, otherwise the store's WhatsApp number */
export function salesContactsOf(site: SiteSettings): SalesContact[] {
  if (site.salesContacts) return site.salesContacts;
  const named = site.phones.flatMap((p) => { const m = p.label.match(/\(([^)]+)\)/); return m ? [{ name: m[1].trim(), role: "Sales", phone: p.tel }] : []; });
  return named.length ? named : site.whatsapp ? [{ name: "Sales team", role: "Sales", phone: site.whatsapp }] : [];
}
export type PaymentSettings = {
  /** mobile: also offer EcoCash / OneMoney prompts on the customer's phone (Paynow mobile transactions) */
  paynow: { enabled: boolean; title: string; description: string; mobile?: boolean };
  cod: { enabled: boolean; title: string; description: string };
  bacs: { enabled: boolean; title: string; description: string; details: string };
  ngenius: { enabled: boolean; title: string; description: string };
};
/** Automatic emails / WhatsApp messages (Admin → Settings → Notifications) */
export type NotificationSettings = {
  /** who gets staff alerts (low stock, quote requests); empty = the store email */
  staffEmails: string[];
  lowStock: boolean;
  backInStock: boolean;
  abandonedCart: boolean; abandonedCartHours: number;
  /** paid-order alerts on WhatsApp (Meta WhatsApp Cloud API; token and phone number id in the server's env) */
  whatsapp: boolean; whatsappTo: string[]; whatsappTemplate: string; whatsappLanguage: string;
};
export type HomeSection =
  | { type: "product-carousel" | "product-grid"; title: string; linkLabel: string; link: string; source: "latest" | "featured" | "on_sale" | "best_selling" | "random"; categoryIds: number[]; limit: number; hideOutOfStock: boolean; banner: null | { image: string; title: string; subtitle: string; text: string; link: string } }
  | { type: "promo-banner"; title: string; html: string; buttonLabel: string; link: string; image: string; background: string };
export type HomepageSettings = { slides: { image: string; link: string; alt: string }[]; sections: HomeSection[] };

const DEFAULTS: Record<string, any> = {
  site: {
    name: "A Lucky Brand", tagline: "", logo: "", noticeEnabled: false, noticeHtml: "", noticeBg: "#ed1b24",
    primaryColor: "#004798", secondaryColor: "#f9d309", currency: "USD", currencySymbol: "$", whatsapp: "", orderOnWhatsapp: false,
    shareNetworks: ["facebook", "linkedin", "whatsapp"], address: "", email: "", hours: [], phones: [], social: [], copyright: "", footerColumns: [],
    marketingNote: "", newsletterTitle: "Join our newsletter", newsletterSubtitle: "", freeShippingThreshold: null, freeShippingMessage: "",
    freeShippingSuccess: "", tawkPropertyId: "", tawkWidgetId: "", gaMeasurementId: "", recaptchaSiteKey: "", seoTitle: "", seoDescription: "",
    chatEnabled: true, assistantEnabled: true, assistantModel: "claude-opus-5-5", assistantName: "Lucky Assistant",
    assistantGreeting: "Hi! I can help you find products, compare options and check specifications. What are you looking for?", assistantDailyLimit: 500, salesContacts: null,
  } satisfies SiteSettings,
  payments: {
    paynow: { enabled: true, title: "Paynow", description: "Pay with EcoCash, OneMoney, InnBucks, Visa or Mastercard via Paynow." },
    cod: { enabled: false, title: "Cash on Collection", description: "" },
    bacs: { enabled: false, title: "Direct bank transfer", description: "", details: "" },
    ngenius: { enabled: false, title: "Credit / Debit card (Visa, Mastercard)", description: "Pay securely with your Visa or Mastercard. You'll enter your card details on our bank's secure payment page." },
  } satisfies PaymentSettings,
  homepage: { slides: [], sections: [] } satisfies HomepageSettings,
  notifications: {
    staffEmails: [], lowStock: true, backInStock: true, abandonedCart: true, abandonedCartHours: 3,
    whatsapp: false, whatsappTo: [], whatsappTemplate: "new_order_alert", whatsappLanguage: "en",
  } satisfies NotificationSettings,
  orderSequence: { next: 10000 },
};

export const getSetting = cache(async <T = any>(key: string): Promise<T> => {
  const row = await prisma.setting.findUnique({ where: { key } });
  const def = DEFAULTS[key];
  if (!row) return def as T;
  if (def && typeof def === "object" && !Array.isArray(def)) return { ...def, ...(row.value as any) } as T;
  return row.value as T;
});
export const getSite = () => getSetting<SiteSettings>("site");

export async function saveSetting(key: string, value: any) {
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
}
