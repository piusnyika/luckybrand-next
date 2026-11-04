import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = await db.query.tags.findFirst({ where: eq(s.tags.slug, (await params).slug) });
  return t ? { title: t.name, alternates: { canonical: `/product-tag/${t.slug}/` } } : {};
}
export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ShopSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const t = await db.query.tags.findFirst({ where: eq(s.tags.slug, slug) });
  if (!t) notFound();
  return <ShopView title={t.name} basePath={`/product-tag/${t.slug}/`} sp={sp} breadcrumbs={[{ label: "Shop", href: "/shop/" }, { label: `Products tagged “${t.name}”` }]} filter={{ tagId: t.id }} />;
}
