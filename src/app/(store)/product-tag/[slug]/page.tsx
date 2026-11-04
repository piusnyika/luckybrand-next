import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = await prisma.tag.findUnique({ where: { slug: (await params).slug } });
  return t ? { title: t.name, alternates: { canonical: `/product-tag/${t.slug}/` } } : {};
}
export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ShopSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const t = await prisma.tag.findUnique({ where: { slug } });
  if (!t) notFound();
  return <ShopView title={t.name} basePath={`/product-tag/${t.slug}/`} sp={sp} breadcrumbs={[{ label: "Shop", href: "/shop/" }, { label: `Products tagged “${t.name}”` }]} filter={{ tagId: t.id }} />;
}
