import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ASSISTANT_MODELS, getSite, getSetting, salesContactsOf, type NotificationSettings, type PaymentSettings } from "@/lib/settings";
import { whatsappConfigured } from "@/lib/whatsapp";
import { PageHeader, Card, Field, SubmitButton, FlashToast } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/MediaPicker";
import { ShippingEditor } from "@/components/admin/ShippingEditor";
import { saveGeneral, saveAppearance, savePayments, saveShipping, saveContact, saveIntegrations, saveNotifications, testWhatsApp } from "./actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";
const TABS = [["general", "Store details"], ["appearance", "Header & footer"], ["payments", "Payments"], ["shipping", "Shipping"], ["contact", "Contact page"], ["notifications", "Notifications"], ["integrations", "Integrations"]] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const tab = (await searchParams).tab || "general";
  const [site, payments, contact, methods, notify] = await Promise.all([getSite(), getSetting<PaymentSettings>("payments"), getSetting<any>("contact"), prisma.shippingMethod.findMany({ orderBy: { sortOrder: "asc" } }), getSetting<NotificationSettings>("notifications")]);
  const check = (name: keyof NotificationSettings, label: React.ReactNode) => <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={!!notify[name]} className="mt-0.5 accent-primary" /><span>{label}</span></label>;
  const env = { paynow: !!process.env.PAYNOW_INTEGRATION_ID && !!process.env.PAYNOW_INTEGRATION_KEY, ngenius: !!process.env.NGENIUS_API_KEY && !!process.env.NGENIUS_OUTLET_REF, smtp: !!process.env.SMTP_HOST, mailchimp: !!process.env.MAILCHIMP_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY };
  return (
    <>
      <FlashToast />
      <PageHeader title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, l]) => <Link key={k} href={`/admin/settings/?tab=${k}`} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"}`}>{l}</Link>)}
      </div>

      {tab === "general" && <form action={saveGeneral}><Card><div className="grid gap-5 md:grid-cols-2">
        <Field label="Store name"><input name="name" defaultValue={site.name} className="field" /></Field>
        <Field label="Tagline"><input name="tagline" defaultValue={site.tagline} className="field" /></Field>
        <ImageField name="logo" defaultValue={site.logo} label="Logo" />
        <ImageField name="favicon" defaultValue={site.favicon} label="Favicon (square)" />
        <ImageField name="logoWhite" defaultValue={site.logoWhite} label="Logo for emails (optional)" />
        <div />
        <Field label="Store email (receives order & contact notifications)"><input name="email" type="email" defaultValue={site.email} className="field" /></Field>
        <Field label="Address"><input name="address" defaultValue={site.address} className="field" /></Field>
        <Field label="Phone numbers" hint="One per line, e.g. +263 772 584 827 (Collin)"><textarea name="phones" rows={4} defaultValue={site.phones.map((p) => p.label).join("\n")} className="field" /></Field>
        <Field label="Opening hours" hint="One per line"><textarea name="hours" rows={4} defaultValue={site.hours.join("\n")} className="field" /></Field>
        <Field label="WhatsApp number for “Order on WhatsApp”"><input name="whatsapp" defaultValue={site.whatsapp} className="field" /></Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="orderOnWhatsapp" defaultChecked={site.orderOnWhatsapp} className="accent-primary" /> Show “Order on WhatsApp” on product pages</label>
        <Field label="Homepage SEO title"><input name="seoTitle" defaultValue={site.seoTitle} className="field" /></Field>
        <Field label="Homepage meta description"><textarea name="seoDescription" rows={2} defaultValue={site.seoDescription} className="field" /></Field>
      </div><div className="mt-6 flex justify-end"><SubmitButton>Save changes</SubmitButton></div></Card></form>}

      {tab === "appearance" && <form action={saveAppearance}><div className="space-y-6">
        <Card title="Announcement bar (top of every page)">
          <p className="text-sm text-ink-soft">The notice bar now holds several messages with their own colours, links and dates. Edit them in <a href="/admin/announcements/" className="font-semibold text-primary hover:underline">Content → Announcements</a>.</p>
        </Card>
        <Card title="Free shipping message (cart, cart drawer and My Cart hover preview)"><div className="grid gap-4 md:grid-cols-2">
          <Field label="Threshold ($)" hint="Order subtotal for free delivery. Leave blank to hide the message." className="md:col-span-2 md:max-w-xs"><input name="freeShippingThreshold" type="number" defaultValue={site.freeShippingThreshold ?? ""} className="field" /></Field>
          <Field label="Message while below the threshold" hint="[remaining] is replaced with the amount still needed, e.g. $35.00"><textarea name="freeShippingMessage" rows={3} defaultValue={site.freeShippingMessage} className="field" /></Field>
          <Field label="Message once the order qualifies"><textarea name="freeShippingSuccess" rows={3} defaultValue={site.freeShippingSuccess} className="field" /></Field>
        </div></Card>
        <Card title="Footer"><div className="grid gap-4 md:grid-cols-2">
          <Field label="Newsletter title"><input name="newsletterTitle" defaultValue={site.newsletterTitle} className="field" /></Field>
          <Field label="Newsletter subtitle (HTML)"><input name="newsletterSubtitle" defaultValue={site.newsletterSubtitle} className="field" /></Field>
          <Field label="Footer columns" hint="One per line: Title | menu-key (edit the links under Menus)"><textarea name="footerColumns" rows={4} defaultValue={site.footerColumns.map((c) => `${c.title} | ${c.menu}`).join("\n")} className="field font-mono text-sm" /></Field>
          <Field label="Social links" hint="One per line: facebook https://… (facebook, instagram, linkedin, twitter, tiktok, youtube, whatsapp)"><textarea name="social" rows={4} defaultValue={site.social.map((x) => `${x.icon} ${x.url}`).join("\n")} className="field font-mono text-sm" /></Field>
          <Field label="Copyright"><input name="copyright" defaultValue={site.copyright} className="field" /></Field>
          <Field label="Footer note (right side)"><input name="marketingNote" defaultValue={site.marketingNote} className="field" /></Field>
        </div></Card>
        <div className="flex justify-end"><SubmitButton>Save changes</SubmitButton></div>
      </div></form>}

      {tab === "payments" && <form action={savePayments}><div className="space-y-6">
        {!env.paynow && <p className="rounded-form bg-amber-50 p-4 text-sm text-amber-800">Paynow keys are not set. Add <code>PAYNOW_INTEGRATION_ID</code> and <code>PAYNOW_INTEGRATION_KEY</code> to <code>.env.local</code> and restart the site.</p>}
        {!env.ngenius && payments.ngenius.enabled && <p className="rounded-form bg-amber-50 p-4 text-sm text-amber-800">N-Genius card payments are enabled but the keys are not set. Add <code>NGENIUS_API_KEY</code> and <code>NGENIUS_OUTLET_REF</code> to <code>.env.local</code> and restart the site.</p>}
        {(["paynow", "ngenius", "cod", "bacs"] as const).map((k) => (
          <Card key={k} title={{ paynow: "Paynow (EcoCash, OneMoney, InnBucks, Visa/Mastercard)", ngenius: "Card payments by N-Genius (Visa, Mastercard)", cod: "Cash on collection", bacs: "Bank transfer" }[k]}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name={`${k}_enabled`} defaultChecked={payments[k].enabled} className="accent-primary" /> Enabled at checkout</label>
              <Field label="Title shown at checkout"><input name={`${k}_title`} defaultValue={payments[k].title} className="field" /></Field>
              <Field label="Description"><input name={`${k}_description`} defaultValue={payments[k].description} className="field" /></Field>
              {k === "paynow" && <label className="flex items-start gap-2 text-sm md:col-span-2"><input type="checkbox" name="paynow_mobile" defaultChecked={!!payments.paynow.mobile} className="mt-0.5 accent-primary" />
                <span>Also offer <strong>EcoCash / OneMoney on the customer&apos;s phone</strong>: they enter their number at checkout and approve a PIN prompt, without leaving the site. Needs mobile payments enabled on your Paynow integration.</span></label>}
              {k === "bacs" && <Field label="Bank account details (shown at checkout and on the order page)" className="md:col-span-2"><textarea name="bacs_details" rows={4} defaultValue={payments.bacs.details} className="field" /></Field>}
            </div>
          </Card>
        ))}
        <div className="flex justify-end"><SubmitButton>Save changes</SubmitButton></div>
      </div></form>}

      {tab === "shipping" && <ShippingEditor action={saveShipping} initial={methods.map((m) => ({ id: m.id, name: m.name, type: m.type, cost: String(Number(m.cost)), minAmount: m.minAmount ? String(Number(m.minAmount)) : "", note: m.note, enabled: m.enabled }))} />}

      {tab === "contact" && <form action={saveContact}><Card><div className="grid gap-4 md:grid-cols-2">
        <Field label="Heading"><input name="heading" defaultValue={contact?.heading} className="field" /></Field>
        <Field label="Sub-heading"><input name="subheading" defaultValue={contact?.subheading} className="field" /></Field>
        <Field label="Google Maps location"><input name="mapQuery" defaultValue={contact?.mapQuery} className="field" /></Field>
        <Field label="Form title"><input name="formTitle" defaultValue={contact?.formTitle} className="field" /></Field>
        <Field label="Form introduction" className="md:col-span-2"><textarea name="formIntro" rows={2} defaultValue={contact?.formIntro} className="field" /></Field>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid gap-2 rounded-form border border-line p-3">
            <input name={`b${i}_title`} defaultValue={contact?.blocks?.[i]?.title} placeholder={`Info block ${i + 1} title`} className="field h-10 text-sm" />
            <textarea name={`b${i}_html`} rows={3} defaultValue={(contact?.blocks?.[i]?.html ?? "").replace(/<br\s*\/?>/g, "\n")} placeholder="Text (one item per line)" className="field text-sm" />
          </div>
        ))}
        <Field label="Social icons" hint="One per line: facebook https://…" className="md:col-span-2"><textarea name="social" rows={4} defaultValue={(contact?.social ?? []).map((x: { icon: string; url: string }) => `${x.icon} ${x.url}`).join("\n")} className="field font-mono text-sm" /></Field>
      </div><div className="mt-6 flex justify-end"><SubmitButton>Save changes</SubmitButton></div></Card></form>}

      {tab === "notifications" && <div className="space-y-6">
        <form action={saveNotifications}><div className="space-y-6">
          <Card title="Staff alerts">
            <Field label="Send staff alerts to" hint={`One email address per line. Empty = the store email (${process.env.ADMIN_EMAIL || site.email || "not set"}). Used for low stock and quote requests.`}>
              <textarea name="staffEmails" rows={3} defaultValue={notify.staffEmails.join("\n")} className="field h-auto py-2" /></Field>
            <div className="mt-4">{check("lowStock", <>Email staff when a product reaches its <strong>low-stock level</strong> (set per product; 2 if empty). One email per product until it&apos;s restocked.</>)}</div>
          </Card>
          <Card title="Customer emails"><div className="space-y-4">
            <Field label="Also send a copy of every invoice and receipt to (BCC)" hint="One email address per line. Each order confirmation, status update, note and resent invoice sent to the customer is blind-copied here, so your office keeps a record. Leave blank to switch off.">
              <textarea name="customerEmailBcc" rows={3} defaultValue={notify.customerEmailBcc.join("\n")} placeholder="web@lucky.co.zw" className="field h-auto py-2" /></Field>
            {check("backInStock", <><strong>Back in stock:</strong> out-of-stock products show &ldquo;Email me when it&apos;s back&rdquo;, and we email everyone who asked once it&apos;s in stock again.</>)}
            {check("abandonedCart", <><strong>Abandoned cart:</strong> remind logged-in customers who left items in their cart and haven&apos;t ordered (one reminder per cart, at most every 3 days).</>)}
            <Field label="Send the cart reminder after (hours)"><input name="abandonedCartHours" type="number" min={1} max={72} defaultValue={notify.abandonedCartHours} className="field max-w-[120px]" /></Field>
          </div></Card>
          <Card title="WhatsApp alerts for new paid orders"><div className="space-y-4">
            <p className="text-sm text-ink-soft">Uses Meta&apos;s WhatsApp Cloud API. Server status: {whatsappConfigured() ? <strong className="text-success">connected</strong> : <strong className="text-amber-700">not connected: add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to the server&apos;s .env (see DEPLOY.md)</strong>}.</p>
            {check("whatsapp", "Send a WhatsApp message to the numbers below for every new paid or on-hold order")}
            <Field label="Staff WhatsApp numbers" hint="One per line, e.g. 0772 123 456 or +263772123456"><textarea name="whatsappTo" rows={3} defaultValue={notify.whatsappTo.join("\n")} className="field h-auto py-2" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Message template name" hint="Approved in WhatsApp Manager, with body variables {{1}} order number, {{2}} customer, {{3}} total"><input name="whatsappTemplate" defaultValue={notify.whatsappTemplate} className="field" /></Field>
              <Field label="Template language code"><input name="whatsappLanguage" defaultValue={notify.whatsappLanguage} className="field" placeholder="en" /></Field>
            </div>
          </div></Card>
          <div className="flex justify-end"><SubmitButton>Save changes</SubmitButton></div>
        </div></form>
        <form action={testWhatsApp}><Card title="Test WhatsApp">
          <p className="mb-3 text-sm text-ink-soft">Sends a sample &ldquo;new order&rdquo; alert to the first number above, using the saved template.</p>
          <SubmitButton className="btn-outline" pendingText="Sending…">Send test message</SubmitButton>
        </Card></form>
      </div>}

      {tab === "integrations" && <form action={saveIntegrations}><div className="space-y-6">
        <Card title="Chat bubble"><div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="chatEnabled" defaultChecked={site.chatEnabled} className="accent-primary" /> Show the chat bubble on the store</label>
          <Field label="WhatsApp sales team" hint="One per line: Name | Role | WhatsApp number. Customers choose who to chat to." className="md:col-span-2"><textarea name="salesContacts" rows={4} defaultValue={salesContactsOf(site).map((c) => `${c.name} | ${c.role} | ${c.phone}`).join("\n")} className="field font-mono text-sm" /></Field>
        </div></Card>
        <Card title="AI assistant"><div className="grid gap-4 md:grid-cols-2">
          {!env.anthropic && <p className="rounded-form bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2">The Anthropic API key is not set, so only WhatsApp is shown. Add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> and restart the site.</p>}
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="assistantEnabled" defaultChecked={site.assistantEnabled} className="accent-primary" /> Offer the AI assistant in the chat bubble</label>
          <Field label="Claude model" hint="Prices are per million tokens. Changes apply to the next message." className="md:col-span-2"><select name="assistantModel" defaultValue={site.assistantModel} className="field">{ASSISTANT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
          <Field label="Assistant name"><input name="assistantName" defaultValue={site.assistantName} className="field" /></Field>
          <Field label="Most AI messages per day" hint="All visitors together. Protects your Anthropic bill; 0 turns replies off."><input name="assistantDailyLimit" type="number" min="0" defaultValue={site.assistantDailyLimit} className="field" /></Field>
          <Field label="Greeting" className="md:col-span-2"><textarea name="assistantGreeting" rows={2} defaultValue={site.assistantGreeting} className="field" /></Field>
        </div></Card>
        <Card title="Google Analytics 4"><Field label="Measurement ID" hint="e.g. G-XXXXXXX"><input name="gaMeasurementId" defaultValue={site.gaMeasurementId} className="field" /></Field></Card>
        <Card title="Tawk.to live chat"><div className="grid gap-4 md:grid-cols-2">
          <Field label="Property ID" hint="From your Tawk.to widget code: embed.tawk.to/PROPERTY_ID/WIDGET_ID"><input name="tawkPropertyId" defaultValue={site.tawkPropertyId} className="field" /></Field>
          <Field label="Widget ID"><input name="tawkWidgetId" defaultValue={site.tawkWidgetId} className="field" /></Field>
        </div></Card>
        <Card title="Server configuration (.env.local)">
          <ul className="space-y-1 text-sm">
            <li>{env.paynow ? "✅" : "⚠️"} Paynow keys {env.paynow ? "configured" : "missing"}</li>
            <li>{env.ngenius ? "✅" : "⚠️"} N-Genius card payment keys {env.ngenius ? "configured" : "missing"}</li>
            <li>{env.smtp ? "✅" : "⚠️"} Email (SMTP) {env.smtp ? "configured" : "missing – order and contact emails are not being sent"}</li>
            <li>{env.anthropic ? "✅" : "⚠️"} Anthropic API key {env.anthropic ? "configured" : "missing – the AI assistant is hidden"}</li>
            <li>{env.mailchimp ? "✅" : "ℹ️"} Mailchimp {env.mailchimp ? "connected" : "not connected (subscribers are still saved in Messages → Subscribers)"}</li>
          </ul>
        </Card>
        <div className="flex justify-end"><SubmitButton>Save changes</SubmitButton></div>
      </div></form>}
    </>
  );
}
