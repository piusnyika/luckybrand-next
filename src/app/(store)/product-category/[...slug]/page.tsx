import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { categoryPath } from "@/lib/catalog";
import { stripHtml } from "@/lib/format";
import { ShopView, type ShopSearchParams } from "@/components/store/ShopView";
import { prisma } from "@/lib/prisma";

async function resolve(slugs: string[]) {
  let page: number | undefined;
  if (slugs.length >= 3 && slugs[slugs.length - 2] === "page") { page = Number(slugs[slugs.length - 1]); slugs = slugs.slice(0, -2); }
  const cat = await prisma.category.findUnique({ where: { slug: slugs[slugs.length - 1] } });
  if (!cat) return null;
  const path = await categoryPath(cat);
  return { cat, path, page, canonical: "/product-category/" + path.map((c) => c.slug).join("/") + "/", requested: "/product-category/" + slugs.join("/") + "/" };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const r = await resolve((await params).slug); if (!r) return {};
  return {
    title: r.cat.seoTitle?.replace(/%%[^%]+%%/g, "").replace(/\s+[-|–]\s*$/, "").trim() || r.cat.name,
    description: r.cat.seoDescription || stripHtml(r.cat.description).slice(0, 160),
    alternates: { canonical: r.canonical },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<ShopSearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await resolve(slug);
  if (!r) notFound();
  if (r.requested !== r.canonical && !r.page) permanentRedirect(r.canonical);
  return (
    <ShopView title={r.cat.name} intro={r.cat.description} basePath={r.canonical} page={r.page} sp={sp}
      breadcrumbs={r.path.map((c, i) => ({ label: c.name, href: "/product-category/" + r.path.slice(0, i + 1).map((x) => x.slug).join("/") + "/" }))}
      filter={{ categoryIds: [r.cat.id] }} activeCategoryIds={[r.cat.id]} />
  );
}
