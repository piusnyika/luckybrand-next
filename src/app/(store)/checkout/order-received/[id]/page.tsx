import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders";
import { poll } from "@/lib/paynow";
import { applyPaynowStatus } from "@/lib/paynow-apply";
import { syncNgeniusOrder } from "@/lib/ngenius";
import { RestoreCartButton } from "@/components/store/RestoreCartButton";
import { getCurrentUser } from "@/lib/auth";
import { getSetting, type PaymentSettings } from "@/lib/settings";
import { OrderDetails } from "@/components/store/OrderDetails";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Icon } from "@/components/Icon";
import { money } from "@/lib/format";
import { AutoRefresh } from "@/components/store/AutoRefresh";

export const metadata: Metadata = { title: "Order received", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderReceived({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ key?: string; mobile?: string }> }) {
  const [{ id }, { key, mobile: rawMobile }] = await Promise.all([params, searchParams]);
  const mobile = rawMobile && /^07\d\*{3}\d{3}$/.test(rawMobile) ? rawMobile : null; // masked number from mobile checkout
  let o = await getOrder(Number(id));
  const user = await getCurrentUser();
  if (!o || (o.accessKey !== key && !(user && (user.id === o.userId || user.role !== "customer")))) notFound();

  // Customer returned from Paynow: ask Paynow for the latest status
  if (o.paymentMethod === "paynow" && o.status === "pending" && o.paynowPollUrl) {
    try { const r = await poll(o.paynowPollUrl); if (r) { await applyPaynowStatus(o.id, o.status, r); o = (await getOrder(o.id))!; } } catch (e) { console.error(e); }
  }
  if (o.paymentMethod === "ngenius" && o.status === "pending" && o.transactionId) {
    try { o = (await syncNgeniusOrder(o.id)) ?? o; } catch (e) { console.error(e); }
  }
  const payments = await getSetting<PaymentSettings>("payments");
  const failed = o.status === "failed" || o.status === "cancelled";
  const waiting = o.status === "pending";
  return (
    <div className="container max-w-4xl">
      <Breadcrumbs items={[{ label: "Checkout", href: "/checkout/" }, { label: "Order received" }]} />
      <div className={`mb-8 flex items-start gap-3 rounded-base p-5 ${failed ? "bg-red-50 text-danger" : waiting ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
        <Icon name={failed ? "close" : waiting ? "clock" : "check"} size={24} />
        <div>
          <p className="text-lg font-semibold">{failed ? "Unfortunately your order cannot be processed." : waiting ? "We’re waiting for your payment to be confirmed." : "Thank you. Your order has been received."}</p>
          {waiting && (mobile
            ? <p className="mt-1 text-sm">We&apos;ve sent a payment request to <strong>{mobile}</strong>. Check your phone and enter your PIN to approve the payment of <strong>{money(o.total)}</strong>. No prompt? Dial <strong>*151*200#</strong> (EcoCash) to see pending payments. <Link href={`?key=${o.accessKey}&mobile=${encodeURIComponent(mobile)}`} className="font-semibold underline">Refresh</Link></p>
            : <p className="mt-1 text-sm">If you completed the {o.paymentMethod === "ngenius" ? "card" : "Paynow"} payment, refresh this page in a moment. <Link href={`?key=${o.accessKey}`} className="font-semibold underline">Refresh</Link></p>)}
          {waiting && (o.paymentMethod === "paynow" || o.paymentMethod === "ngenius") && <AutoRefresh />}
          {failed && <>
            <p className="mt-1 text-sm">The payment was not completed and you have not been charged. Put the items back in your cart to try again, or contact us for help.</p>
            <RestoreCartButton lines={o.items.filter((i) => i.productId && i.slug).map((i) => ({ id: i.productId!, qty: i.quantity, name: i.name, slug: i.slug!, price: Number(i.unitPrice), image: i.image ?? null }))} />
          </>}
        </div>
      </div>
      {o.paymentMethod === "bacs" && payments.bacs.details && <div className="mb-8 rounded-base border border-line p-5"><h2 className="mb-2 font-semibold">Our bank details</h2><pre className="whitespace-pre-wrap font-sans text-sm">{payments.bacs.details}</pre></div>}
      <OrderDetails o={o} />
    </div>
  );
}
