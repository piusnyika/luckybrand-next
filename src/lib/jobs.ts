import "server-only";
import { prisma, Prisma } from "@/lib/prisma";
import { getSetting, getSite, type NotificationSettings } from "./settings";
import { escapeHtml, layout, mailButton, sendMail, staffEmails } from "./mail";
import { money } from "./format";

/**
 * Automatic emails, run with the payment check every 5 minutes (src/app/api/cron/payments): abandoned-cart reminders,
 * back-in-stock alerts and low-stock alerts to staff. Each one is switched on/off in Admin → Settings → Notifications.
 */
export async function runBackgroundJobs() {
  const n = await getSetting<NotificationSettings>("notifications");
  const out: Record<string, number | string> = {};
  const run = async (name: string, on: boolean, fn: () => Promise<number>) => {
    if (!on) return;
    try { out[name] = await fn(); } catch (e) { out[name] = "error"; console.error(`job ${name}:`, e); }
  };
  await run("abandonedCarts", n.abandonedCart, () => abandonedCarts(n.abandonedCartHours));
  await run("backInStock", n.backInStock, backInStock);
  await run("lowStock", n.lowStock, lowStock);
  // search log (Admin → Search): forget searches nobody has made for a year
  await run("searchLog", true, async () => {
    // forget searches nobody has made for a year, plus keep at most 10,000 of the most recent (bot-flood protection)
    const [a, b] = await Promise.all([
      prisma.$executeRaw`DELETE FROM search_terms WHERE last_at < NOW() - INTERVAL '365 days'`,
      prisma.$executeRaw`DELETE FROM search_terms WHERE id IN (SELECT id FROM search_terms ORDER BY last_at DESC OFFSET 10000)`,
    ]);
    return Number(a) + Number(b);
  });
  return out;
}

const base = () => process.env.SITE_URL || "";

/** One reminder per cart: logged-in customers who left items for `hours` (but not over 7 days) and haven't ordered since */
async function abandonedCarts(hours: number) {
  const due = await prisma.$queryRaw<{ userId: number }[]>`
    SELECT c.user_id AS "userId" FROM saved_carts c JOIN users u ON u.id = c.user_id
    WHERE c.updated_at < ${new Date(Date.now() - Math.max(1, hours) * 3_600_000)} AND c.updated_at > ${new Date(Date.now() - 7 * 86_400_000)}
      AND (c.reminded_at IS NULL OR (c.reminded_at < c.updated_at AND c.reminded_at < NOW() - INTERVAL '3 days'))
      AND NOT u.blocked AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE (o.user_id = u.id OR lower(o.email) = lower(u.email)) AND o.created_at > c.updated_at)
    LIMIT 50`;
  if (!due.length) return 0;
  const site = await getSite(); const { quoteCart } = await import("./orders");
  let sent = 0;
  for (const { userId } of due) {
    const c = await prisma.savedCart.findUnique({ where: { userId }, include: { user: { select: { email: true, firstName: true } } } });
    if (!c) continue;
    const saved = (c.lines as { id: number; qty: number }[]) ?? [];
    const q = await quoteCart(saved.map((l) => ({ id: l.id, qty: l.qty }))); // today's prices; drops items no longer sold
    // mark first, so a mail error can't turn into a reminder every 5 minutes (raw SQL: leaves updated_at alone)
    await prisma.$executeRaw`UPDATE saved_carts SET reminded_at = NOW() WHERE user_id = ${userId}`;
    if (!q.lines.length) continue;
    const rows = q.lines.map((l) => `<tr><td style="padding:8px;border-bottom:1px solid #dfe2e6">${l.image ? `<img src="${base()}${l.image}" width="56" height="56" style="object-fit:contain;vertical-align:middle;margin-right:10px">` : ""}${escapeHtml(l.name)} × ${l.qty}</td><td style="padding:8px;border-bottom:1px solid #dfe2e6;text-align:right">${money(l.total)}</td></tr>`).join("");
    await sendMail(c.user.email, `You left something in your cart at ${site.name}`, await layout("Still thinking it over?",
      `<p>Hi ${escapeHtml(c.user.firstName || "there")},</p><p>You left these in your cart. They're saved for you, but stock can change, so don't wait too long.</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0">${rows}</table>
       <p style="font-size:14px"><strong>Subtotal: ${money(q.subtotal)}</strong></p>${mailButton(`${base()}/cart/`, "Return to my cart")}
       <p style="font-size:12px;color:#737582">Questions? Just reply to this email or chat with us on WhatsApp.</p>`), site.email || undefined);
    sent++;
  }
  return sent;
}

/** "Email me when it's back": sent once the product is in stock (or on backorder) and published again */
async function backInStock() {
  const alerts = await prisma.stockAlert.findMany({
    where: { notifiedAt: null, product: { status: "published", stockStatus: { not: "outofstock" } } },
    include: { product: { select: { name: true, slug: true, image: { select: { url: true } } } } }, take: 100,
  });
  if (!alerts.length) return 0;
  const site = await getSite();
  for (const a of alerts) {
    await prisma.stockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
    const url = `${base()}/product/${a.product.slug}/`;
    await sendMail(a.email, `Back in stock: ${a.product.name}`, await layout("It's back in stock",
      `${a.product.image ? `<p><img src="${base()}${a.product.image.url}" width="160" style="max-width:160px"></p>` : ""}
       <p><strong>${escapeHtml(a.product.name)}</strong> is available again at ${escapeHtml(site.name)}.</p>${mailButton(url, "View product")}
       <p style="font-size:12px;color:#737582">You asked us to tell you when it was back. This is the only email you'll get about it.</p>`));
  }
  return alerts.length;
}

/** One email to staff listing products whose stock dropped to their low-stock level; re-armed once restocked */
async function lowStock() {
  // restocked since the last alert: allow a new one next time
  await prisma.$executeRaw`UPDATE products SET low_stock_notified_at = NULL
    WHERE low_stock_notified_at IS NOT NULL AND (NOT manage_stock OR stock_qty > COALESCE(low_stock_amount, 2))`;
  const low = await prisma.$queryRaw<{ id: number; name: string; sku: string | null; stockQty: number; threshold: number }[]>`
    SELECT id, name, sku, stock_qty AS "stockQty", COALESCE(low_stock_amount, 2) AS threshold FROM products
    WHERE status = 'published' AND type = 'simple' AND manage_stock AND stock_qty <= COALESCE(low_stock_amount, 2) AND low_stock_notified_at IS NULL
    ORDER BY stock_qty, name LIMIT 200`;
  if (!low.length) return 0;
  await prisma.$executeRaw`UPDATE products SET low_stock_notified_at = NOW() WHERE id IN (${Prisma.join(low.map((p) => p.id))})`;
  const to = await staffEmails();
  if (!to.length) return 0;
  const site = await getSite();
  const rows = low.map((p) => `<tr><td style="padding:6px 8px;border:1px solid #dfe2e6"><a href="${base()}/admin/products/${p.id}/">${escapeHtml(p.name)}</a>${p.sku ? ` <small style="color:#737582">${escapeHtml(p.sku)}</small>` : ""}</td><td style="padding:6px 8px;border:1px solid #dfe2e6;text-align:right;${p.stockQty <= 0 ? "color:#ed1b24;font-weight:bold" : ""}">${p.stockQty <= 0 ? "Sold out" : p.stockQty}</td></tr>`).join("");
  await sendMail(to.join(", "), `[${site.name}] Low stock: ${low.length} product${low.length === 1 ? "" : "s"}`, await layout("Low stock",
    `<p>These products have reached their low-stock level:</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">
     <tr><th style="padding:6px 8px;border:1px solid #dfe2e6;text-align:left">Product</th><th style="padding:6px 8px;border:1px solid #dfe2e6;text-align:right">In stock</th></tr>${rows}</table>
     ${mailButton(`${base()}/admin/products/?stock=low`, "See low-stock products")}<p style="font-size:12px;color:#737582">You'll hear about each product again only after it has been restocked.</p>`));
  return low.length;
}
