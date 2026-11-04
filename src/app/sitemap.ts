import type { MetadataRoute } from "next";
import { categoryUrlMap } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

// built on request: there is no database during the Docker image build
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "http://localhost:3000";
  const [products, pages, brands, cats] = await Promise.all([
    prisma.product.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ select: { slug: true } }), categoryUrlMap(),
  ]);
  return [
    { url: base + "/", changeFrequency: "daily", priority: 1 },
    { url: base + "/shop/", changeFrequency: "daily", priority: 0.9 },
    ...[...cats.values()].map((u) => ({ url: base + u, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}/`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...brands.map((b) => ({ url: `${base}/brand/${b.slug}/`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...pages.map((p) => ({ url: `${base}/${p.slug}/`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
