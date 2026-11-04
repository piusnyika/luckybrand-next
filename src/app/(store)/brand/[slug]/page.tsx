import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await db.query.brands.findFirst({ where: eq(s.brands.slug, (await params).slug) });
  return b ? { title: b.name, alternates: { canonical: `/brand/${b.slug}/` } } : {};
}
export default async function BrandPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ShopSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const b = await db.query.brands.findFirst({ where: eq(s.brands.slug, slug) });
  if (!b) notFound();
  return <ShopView title={b.name} intro={b.description} basePath={`/brand/${b.slug}/`} sp={sp} breadcrumbs={[{ label: "Shop", href: "/shop/" }, { label: b.name }]} filter={{ brandId: b.id }} />;
}
