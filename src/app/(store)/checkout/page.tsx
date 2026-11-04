import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { googleEnabled } from "@/lib/google";
import { ngeniusConfigured } from "@/lib/ngenius";
import { getSetting, type PaymentSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CheckoutForm } from "@/components/store/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export default async function Checkout() {
  const [user, payments] = await Promise.all([getCurrentUser(), getSetting<PaymentSettings>("payments")]);
  const methods = (Object.entries(payments) as [keyof PaymentSettings, PaymentSettings[keyof PaymentSettings]][])
    .filter(([id, m]) => m?.enabled && (id !== "ngenius" || ngeniusConfigured())) // card option only once its keys are set
    .map(([id, m]) => ({ id, title: m.title, description: m.description, details: "details" in m ? m.details : "", mobile: id === "paynow" && "mobile" in m && !!m.mobile }));
  const b = user?.billing ?? {};
  return (
    <div className="container">
      <Breadcrumbs items={[{ label: "Cart", href: "/cart/" }, { label: "Checkout" }]} />
      <CheckoutForm loggedIn={!!user} google={googleEnabled()} methods={methods} initial={{
        firstName: b.firstName || user?.firstName || "", lastName: b.lastName || user?.lastName || "", company: b.company || "",
        address1: b.address1 || "", address2: b.address2 || "", city: b.city || "", state: b.state || "", postcode: b.postcode || "",
        email: b.email || user?.email || "", phone: b.phone || user?.phone || "",
      }} />
    </div>
  );
}
