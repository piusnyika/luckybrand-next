import "server-only";
import { setOrderStatus, addNote, getOrder } from "./orders";
import { prisma } from "@/lib/prisma";

/**
 * N-Genius (Network International) hosted payment page: Visa / Mastercard.
 * Flow: create an N-Genius order -> redirect the customer to its payment page -> on return / webhook,
 * fetch the order from the N-Genius API (never trust the redirect or webhook body) and update our order.
 * The N-Genius order reference is kept in orders.transactionId.
 */
const base = () => (process.env.NGENIUS_API_URL || "https://api-gateway.sandbox.ngenius-payments.com").replace(/\/+$/, "");
export const ngeniusConfigured = () => !!(process.env.NGENIUS_API_KEY && process.env.NGENIUS_OUTLET_REF);
const PAYMENT_TYPE = "application/vnd.ni-payment.v2+json";

let token: { value: string; until: number } | null = null;
async function accessToken() {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(`${base()}/identity/auth/access-token`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Basic ${process.env.NGENIUS_API_KEY}`, "Content-Type": "application/vnd.ni-identity.v1+json", Accept: "application/vnd.ni-identity.v1+json" },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`N-Genius login failed (HTTP ${res.status}${j.message ? `: ${j.message}` : ""}). Check NGENIUS_API_KEY and NGENIUS_API_URL.`);
  token = { value: j.access_token, until: Date.now() + Math.max(30, Number(j.expires_in || 300) - 30) * 1000 };
  return token.value;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base()}/transactions/outlets/${process.env.NGENIUS_OUTLET_REF}${path}`, {
    ...init, signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${await accessToken()}`, Accept: PAYMENT_TYPE, ...(init.body ? { "Content-Type": PAYMENT_TYPE } : {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`N-Genius error (HTTP ${res.status}): ${JSON.stringify(j.errors ?? j.message ?? j).slice(0, 500)}`);
  return j;
}

/** Amounts are sent in minor units (cents) */
const minor = (amount: number) => Math.round(amount * 100);

export async function createPayment(o: {
  orderNumber: string; amount: number; currency: string; email: string;
  billing: { firstName?: string; lastName?: string; address1?: string; city?: string };
  redirectUrl: string; cancelUrl: string;
}) {
  const j = await api("/orders", {
    method: "POST",
    body: JSON.stringify({
      action: process.env.NGENIUS_ACTION || "PURCHASE", // PURCHASE or SALE: charge straight away; AUTH: authorise only
      amount: { currencyCode: o.currency, value: minor(o.amount) },
      merchantOrderReference: o.orderNumber, emailAddress: o.email,
      billingAddress: { firstName: o.billing.firstName || "", lastName: o.billing.lastName || "", address1: o.billing.address1 || "", city: o.billing.city || "", countryCode: "ZW" },
      merchantAttributes: { redirectUrl: o.redirectUrl, cancelUrl: o.cancelUrl, cancelText: "Back to store", skipConfirmationPage: true },
    }),
  });
  const url = j?._links?.payment?.href;
  if (!j.reference || !url) throw new Error("N-Genius did not return a payment page link");
  return { reference: String(j.reference), paymentUrl: String(url) };
}

/** Current state of an N-Genius order (from its latest payment attempt) */
export async function fetchPayment(reference: string) {
  const j = await api(`/orders/${encodeURIComponent(reference)}`);
  const payments: any[] = j?._embedded?.payment ?? [];
  const p = payments[payments.length - 1] ?? {};
  return { state: String(p.state || j.state || "STARTED").toUpperCase(), amount: Number(j?.amount?.value ?? NaN), currency: String(j?.amount?.currencyCode || ""), paymentId: String(p._id || "").split(":").pop() || "" };
}

const PAID = ["PURCHASED", "CAPTURED"], FAILED = ["FAILED", "DECLINED"], CANCELLED = ["REVERSED", "CANCELLED", "VOIDED"];

/** Re-checks an order with N-Genius and moves it to the right status. Safe to call repeatedly (return page + webhook). */
export async function syncNgeniusOrder(orderId: number) {
  const o = await getOrder(orderId);
  if (!o || o.paymentMethod !== "ngenius" || !o.transactionId) return o;
  const p = await fetchPayment(o.transactionId);
  const open = o.status === "pending" || o.status === "failed";
  const by = "N-Genius";
  if (PAID.includes(p.state) || p.state === "AUTHORISED") {
    const amountOk = p.amount === minor(Number(o.total));
    const ref = `N-Genius order ${o.transactionId}${p.paymentId ? `, payment ${p.paymentId}` : ""}`;
    if (!amountOk) {
      if (o.status !== "on-hold") await setOrderStatus(o.id, "on-hold", by, `Payment ${p.state.toLowerCase()} but the amount (${p.amount / 100} ${p.currency}) doesn't match the order total. Check it in the N-Genius portal. ${ref}.`);
    } else if (p.state === "AUTHORISED") {
      if (open) await setOrderStatus(o.id, "on-hold", by, `Card payment authorised but not captured yet. Capture it in the N-Genius portal. ${ref}.`);
    } else if (open) {
      await setOrderStatus(o.id, "processing", by, `Card payment received (${p.state}). ${ref}.`);
    } else if (o.status === "cancelled") {
      // paid after the order was cancelled: money taken, so flag it instead of ignoring it
      await setOrderStatus(o.id, "on-hold", by, `Card payment received AFTER the order was cancelled. Fulfil or refund it. ${ref}.`);
    }
  } else if (FAILED.includes(p.state) && o.status === "pending") {
    await setOrderStatus(o.id, "failed", by, `Card payment ${p.state.toLowerCase()}.`);
  } else if (CANCELLED.includes(p.state) && o.status === "pending") {
    await setOrderStatus(o.id, "cancelled", by, `Card payment ${p.state.toLowerCase()}.`);
  }
  return getOrder(o.id);
}

/** Customer pressed "Back to store" on the payment page without paying */
export async function cancelUnpaidNgeniusOrder(orderId: number) {
  const o = await syncNgeniusOrder(orderId);
  if (o && o.status === "pending") await setOrderStatus(o.id, "cancelled", "N-Genius", "Customer cancelled on the card payment page.");
}

export async function saveReference(orderId: number, reference: string) {
  await prisma.order.update({ where: { id: orderId }, data: { transactionId: reference } });
  await addNote(orderId, `Customer redirected to the N-Genius card payment page (order ${reference}).`, false, "N-Genius");
}
