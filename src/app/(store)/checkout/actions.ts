"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { quoteCart, createOrder, setOrderStatus, addNote } from "@/lib/orders";
import { getSetting, type PaymentSettings } from "@/lib/settings";
import { getCurrentUser, createSession } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/verify-email";
import { hashPassword } from "@/lib/password";
import { initiate, initiateMobile, normalisePhone } from "@/lib/paynow";
import { createPayment, saveReference } from "@/lib/ngenius";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const addr = z.object({
  firstName: z.string().trim().min(1, "First name is required"), lastName: z.string().trim().min(1, "Last name is required"),
  company: z.string().trim().optional().default(""), address1: z.string().trim().min(1, "Street address is required"),
  address2: z.string().trim().optional().default(""), city: z.string().trim().min(1, "Town / City is required"),
  state: z.string().trim().optional().default(""), postcode: z.string().trim().optional().default(""), country: z.string().default("ZW"),
});
const schema = z.object({
  lines: z.array(z.object({ id: z.number(), qty: z.number() })).min(1, "Your cart is empty"),
  coupon: z.string().nullable().optional(), shippingMethodId: z.number().nullable().optional(),
  billing: addr, email: z.string().trim().email("Please enter a valid email address"), phone: z.string().trim().min(7, "Phone is required"),
  shipToDifferent: z.boolean().default(false), shipping: addr.partial().optional(),
  note: z.string().max(2000).optional().default(""), paymentMethod: z.enum(["paynow", "cod", "bacs", "ngenius"]),
  createAccount: z.boolean().default(false), password: z.string().optional(),
  paynowMobile: z.object({ phone: z.string(), method: z.enum(["ecocash", "onemoney"]) }).optional(),
});
export type CheckoutInput = z.input<typeof schema>;

export async function placeOrder(input: CheckoutInput): Promise<{ ok: true; redirect: string } | { ok: false; errors: string[] }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const d = parsed.data;
  // each order holds stock until it is paid or times out
  if (!(await rateLimit("checkout:" + clientIp(await headers()), 20, 3600))) return { ok: false, errors: ["Too many orders from your connection. Please try again later or contact us."] };
  const payments = await getSetting<PaymentSettings>("payments");
  const pm = payments[d.paymentMethod];
  if (!pm?.enabled) return { ok: false, errors: ["Please choose a valid payment method."] };
  const mobile = d.paymentMethod === "paynow" && d.paynowMobile && payments.paynow.mobile ? d.paynowMobile : null;
  const mobilePhone = mobile ? normalisePhone(mobile.phone) : null;
  if (mobile && !mobilePhone) return { ok: false, errors: ["Please enter a valid EcoCash / OneMoney number, e.g. 0771234567."] };

  const quote = await quoteCart(d.lines, d.coupon, d.shippingMethodId);
  if (!quote.lines.length) return { ok: false, errors: ["Your cart is empty."] };
  if (quote.errors.length) return { ok: false, errors: quote.errors };
  if (d.coupon && quote.couponError) return { ok: false, errors: [quote.couponError] };

  let user = await getCurrentUser();
  if (!user && d.createAccount) {
    const exists = await prisma.user.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } }, select: { id: true } });
    if (exists) return { ok: false, errors: ["An account is already registered with your email address. Please log in."] };
    if (!d.password || d.password.length < 8) return { ok: false, errors: ["Please choose an account password of at least 8 characters."] };
    const created = await prisma.user.create({ data: {
      email: d.email.toLowerCase(), passwordHash: await hashPassword(d.password), firstName: d.billing.firstName, lastName: d.billing.lastName,
      displayName: `${d.billing.firstName} ${d.billing.lastName}`, phone: d.phone, role: "customer",
      billing: { ...d.billing, email: d.email, phone: d.phone },
    } });
    // logged in for this order straight away; the address is confirmed by email before the next login
    await createSession(created.id);
    await sendVerificationEmail(created.id).catch((e) => console.error("verification mail:", e));
    user = created;
  }
  const h = await headers();
  const billing = { ...d.billing, email: d.email, phone: d.phone };
  const order = await createOrder({
    quote, billing, shipping: d.shipToDifferent ? ({ ...d.billing, ...d.shipping } as typeof billing) : null,
    email: d.email, phone: d.phone, note: d.note, paymentMethod: d.paymentMethod, paymentMethodTitle: pm.title,
    userId: user?.id ?? null, ip: (h.get("x-forwarded-for") || "").split(",")[0].trim(),
  });
  if (user && !user.billing) await prisma.user.update({ where: { id: user.id }, data: { billing, phone: d.phone } });

  const base = process.env.SITE_URL || `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const thankYou = `/checkout/order-received/${order.id}/?key=${order.accessKey}`;
  if (mobile && mobilePhone) {
    try {
      const pn = await initiateMobile({
        reference: order.number, amount: Number(order.total), info: `Order #${order.number}`, email: d.email,
        returnUrl: base + thankYou, resultUrl: `${base}/api/paynow/result/?order=${order.id}`, phone: mobilePhone, method: mobile.method,
      });
      await prisma.order.update({ where: { id: order.id }, data: { paynowPollUrl: pn.pollUrl, paymentMethodTitle: `${pm.title} (${mobile.method === "onemoney" ? "OneMoney" : "EcoCash"} ${mobilePhone})` } });
      await addNote(order.id, `${mobile.method === "onemoney" ? "OneMoney" : "EcoCash"} prompt sent to ${mobilePhone}.${pn.instructions ? " Paynow: " + pn.instructions : ""}`, false, "Paynow");
      return { ok: true, redirect: `${thankYou}&mobile=${mobilePhone.slice(0, 3)}***${mobilePhone.slice(-3)}` };
    } catch (e: any) {
      await addNote(order.id, "Paynow mobile error: " + e.message, false, "Paynow");
      await setOrderStatus(order.id, "failed", "Paynow", "Could not send the mobile money prompt: " + e.message);
      return { ok: false, errors: [`We couldn't send the payment prompt to ${mobilePhone}. Check the number and network, or choose "Pay on the Paynow website".`] };
    }
  }
  if (d.paymentMethod === "paynow") {
    try {
      const pn = await initiate({
        reference: order.number, amount: Number(order.total), info: `Order #${order.number}`, email: d.email,
        returnUrl: base + thankYou, resultUrl: `${base}/api/paynow/result/?order=${order.id}`,
      });
      await prisma.order.update({ where: { id: order.id }, data: { paynowPollUrl: pn.pollUrl } });
      await addNote(order.id, "Customer redirected to Paynow.", false, "Paynow");
      return { ok: true, redirect: pn.browserUrl };
    } catch (e: any) {
      await addNote(order.id, "Paynow error: " + e.message, false, "Paynow");
      await setOrderStatus(order.id, "failed", "Paynow", "Could not start the Paynow payment: " + e.message);
      return { ok: false, errors: ["We couldn't connect to Paynow right now. Please try again or choose another payment method."] };
    }
  }
  if (d.paymentMethod === "ngenius") {
    try {
      const back = `${base}/api/ngenius/return/?order=${order.id}&key=${order.accessKey}`;
      const site = await getSetting<{ currency: string }>("site");
      const pay = await createPayment({
        orderNumber: order.number, amount: Number(order.total), currency: site.currency || "USD", email: d.email,
        billing: d.billing, redirectUrl: back, cancelUrl: back + "&cancel=1",
      });
      await saveReference(order.id, pay.reference);
      return { ok: true, redirect: pay.paymentUrl };
    } catch (e: any) {
      await addNote(order.id, "N-Genius error: " + e.message, false, "N-Genius");
      await setOrderStatus(order.id, "failed", "N-Genius", "Could not start the card payment: " + e.message);
      return { ok: false, errors: ["We couldn't connect to the card payment service right now. Please try again or choose another payment method."] };
    }
  }
  await setOrderStatus(order.id, d.paymentMethod === "bacs" ? "on-hold" : "processing", "checkout", d.paymentMethod === "bacs" ? "Awaiting bank transfer payment." : "Payment to be made on collection.");
  return { ok: true, redirect: thankYou };
}
