import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await prisma.brand.findUnique({ where: { slug: (await params).slug } });
  return b ? { title: b.name, alternates: { canonical: `/brand/${b.slug}/` } } : {};
}
export default async function BrandPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ShopSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const b = await prisma.brand.findUnique({ where: { slug } });
  if (!b) notFound();
  return <ShopView title={b.name} intro={b.description} basePath={`/brand/${b.slug}/`} sp={sp} breadcrumbs={[{ label: "Shop", href: "/shop/" }, { label: b.name }]} filter={{ brandId: b.id }} />;
}
