import type { Metadata } from "next";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";

export const metadata: Metadata = { title: "Shop", alternates: { canonical: "/shop/" } };
export default async function Shop({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const sp = await searchParams;
  return <ShopView title="Shop" basePath="/shop/" breadcrumbs={[{ label: sp.s ? `Search results for “${sp.s}”` : "Shop" }]} filter={{}} sp={sp} />;
}
