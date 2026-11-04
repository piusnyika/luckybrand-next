import "server-only";
import { getSetting, type NotificationSettings } from "./settings";

/**
 * Staff alerts on WhatsApp through Meta's WhatsApp Cloud API. Business-started messages must use a template
 * approved in WhatsApp Manager; ours has three body variables: {{1}} order number, {{2}} customer, {{3}} total.
 * Server env: WHATSAPP_TOKEN (permanent system-user token) and WHATSAPP_PHONE_NUMBER_ID.
 */
export const whatsappConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Zimbabwe numbers in any common format → international digits (0772… → 263772…) */
export const waNumber = (n: string) => { const d = n.replace(/\D/g, ""); return d.startsWith("0") ? "263" + d.slice(1) : d; };

export async function sendWhatsAppTemplate(to: string, template: string, language: string, params: string[]) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: waNumber(to), type: "template",
      template: { name: template, language: { code: language }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 200) })) }] },
    }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(`WhatsApp HTTP ${res.status}: ${j?.error?.message || "error"}`); }
}

/** "New paid order" alert to every staff number in Settings → Notifications. Never throws. */
export async function notifyOrderOnWhatsApp(o: { number: string; total: string; billing: { firstName?: string; lastName?: string } | null }) {
  try {
    const n = await getSetting<NotificationSettings>("notifications");
    if (!n.whatsapp || !n.whatsappTo.length || !whatsappConfigured()) return;
    const customer = `${o.billing?.firstName ?? ""} ${o.billing?.lastName ?? ""}`.trim() || "a customer";
    for (const to of n.whatsappTo) await sendWhatsAppTemplate(to, n.whatsappTemplate, n.whatsappLanguage, [`#${o.number}`, customer, `$${Number(o.total).toFixed(2)}`])
      .catch((e) => console.error("whatsapp to", to, (e as Error).message));
  } catch (e) { console.error("whatsapp:", (e as Error).message); }
}
