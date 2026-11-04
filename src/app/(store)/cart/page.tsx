import type { Metadata } from "next";
import { CartView } from "@/components/store/CartView";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { getSite } from "@/lib/settings";
export const metadata: Metadata = { title: "Cart", robots: { index: false } };
export default async function CartPage() {
  const site = await getSite();
  return <div className="container"><Breadcrumbs items={[{ label: "Cart" }]} /><CartView freeShipping={{ threshold: site.freeShippingThreshold, message: site.freeShippingMessage, success: site.freeShippingSuccess }} /></div>;
}
