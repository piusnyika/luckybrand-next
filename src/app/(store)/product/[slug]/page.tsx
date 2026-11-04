import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, relatedProducts, categoryPath, categoryUrlMap } from "@/lib/catalog";
import { getSite } from "@/lib/settings";
import { money, stripHtml, jsonLd } from "@/lib/format";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Gallery } from "@/components/store/Gallery";
import { BuyBox } from "@/components/store/BuyBox";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductTabs } from "@/components/store/ProductTabs";
import { getBundleItems, bundleMaxQty, bundlePrice } from "@/lib/bundles";
import { Icon } from "@/components/Icon";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { productReviews } from "@/lib/reviews";
import { Reviews } from "@/components/store/Reviews";
import { Stars } from "@/components/store/Stars";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProductBySlug(decodeURIComponent((await params).slug));
  if (!p) return {};
  const desc = p.seoDescription || stripHtml(p.shortDescription || p.description).slice(0, 160);
  return {
    title: p.seoTitle?.replace(/%%[^%]+%%/g, "").replace(/\s+[-|–]\s*$/, "").trim() || p.name, description: desc,
    alternates: { canonical: `/product/${p.slug}/` },
    openGraph: { title: p.name, description: desc, images: p.gallery[0] ? [p.gallery[0].url] : [], type: "website" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProductBySlug(decodeURIComponent((await params).slug));
  if (!p) notFound();
  prisma.product.update({ where: { id: p.id }, data: { views: { increment: 1 } }, select: { id: true } }).catch(() => {});

  const [site, urls, rev, user] = await Promise.all([getSite(), categoryUrlMap(), productReviews(p.id), getCurrentUser()]);
  const primary = p.categoryList.find((c) => c.id === p.primaryCategoryId) ?? p.categoryList[0];
  // the longest path through the main category, so the breadcrumb shows every level the product is filed under
  const paths = await Promise.all(p.categoryList.map((c) => categoryPath(c)));
  const trail = paths.filter((t) => t.some((c) => c.id === primary?.id)).reduce<typeof paths[number]>((a, t) => (t.length > a.length ? t : a), []);
  const related = await relatedProducts(p.id, p.categoryList.map((c) => c.id), 5);
  const bundle = p.type === "bundle" ? (await getBundleItems([p.id])).get(p.id) ?? [] : null;
  const bundleMax = bundle ? bundleMaxQty(bundle) : null;
  const price = bundle ? bundlePrice(bundle) : p.price;
  const stockStatus = bundle ? (bundleMax === 0 ? "outofstock" : "instock") : p.stockStatus;
  const base = process.env.SITE_URL || "";
  const url = `${base}/product/${p.slug}/`;
  const share: Record<string, string> = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(p.name + " " + url)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(p.name)}`,
  };
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku || undefined,
    image: p.gallery.map((g) => base + g.url), description: stripHtml(p.shortDescription || p.description).slice(0, 500),
    brand: p.brandList[0] ? { "@type": "Brand", name: p.brandList[0].name } : undefined,
    offers: { "@type": "Offer", url, priceCurrency: site.currency, price: price.toFixed(2),
      availability: stockStatus === "outofstock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" },
    // star ratings in Google results
    ...(rev.count ? {
      aggregateRating: { "@type": "AggregateRating", ratingValue: rev.avg, reviewCount: rev.count, bestRating: 5, worstRating: 1 },
      review: rev.reviews.slice(0, 5).map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, datePublished: r.createdAt.toISOString().slice(0, 10),
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 }, ...(r.title ? { name: r.title } : {}), reviewBody: r.body })),
    } : {}),
  };

  return (
    <div className="container">
      <Breadcrumbs items={[...trail.map((c) => ({ label: c.name, href: urls.get(c.id) })), { label: p.name }]} />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={p.gallery} name={p.name} videoUrl={p.videoUrl} />
        <div>
          <h1 className="border-b border-line pb-4 text-2xl font-semibold leading-tight lg:text-[28px]">{p.name}</h1>
          <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-primary">
            <Stars value={rev.avg} />{rev.count ? `${rev.avg.toFixed(1)} (${rev.count} review${rev.count === 1 ? "" : "s"})` : "Be the first to review"}
          </a>
          <div className="mt-5 text-2xl font-bold lg:text-[26px]">
            {!bundle && p.onSale && <del className="mr-2 text-lg font-medium text-ink-muted">{money(p.regularPrice)}</del>}
            <span className={!bundle && p.onSale ? "text-danger" : ""}>{money(price)}</span>
          </div>
          <span className={`mt-3 inline-block rounded px-2 py-1 text-xs font-semibold ${stockStatus === "outofstock" ? "bg-red-50 text-danger" : "bg-green-50 text-success"}`}>
            {stockStatus === "outofstock" ? "Out of stock" : stockStatus === "onbackorder" ? "Available on backorder" : "In Stock"}
          </span>
          {p.shortDescription && <div className="prose-lb mt-4 text-[13px]" dangerouslySetInnerHTML={{ __html: p.shortDescription }} />}
          {bundle && (
            <div className="mt-5 rounded-base border border-line">
              <div className="border-b border-line px-4 py-2.5">
                <h2 className="text-sm font-semibold">What&apos;s in this bundle</h2>
              </div>
              <ul className="divide-y divide-line">
                {bundle.filter((i) => !i.missing).map((i) => (
                  <li key={i.productId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.image ? <img src={i.image} alt="" className="h-11 w-11 shrink-0 rounded object-contain" /> : <span className="h-11 w-11 shrink-0 rounded bg-surface" />}
                    <span className="min-w-0 flex-1"><strong>{i.qty} ×</strong>{" "}
                      {i.status === "published" ? <Link href={`/product/${i.slug}/`} className="hover:text-primary">{i.name}</Link> : i.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <BuyBox product={{ id: p.id, name: p.name, slug: p.slug, price, image: p.gallery[0]?.url ?? null, stockStatus }}
            maxQty={bundle ? bundleMax : p.manageStock ? p.stockQty : null} whatsapp={site.orderOnWhatsapp ? site.whatsapp : ""} productUrl={url} />
          <div className="mt-6 space-y-1.5 text-xs">
            {p.sku && <div><span className="text-ink-muted">SKU: </span><span className="font-medium">{p.sku}</span></div>}
            {p.categoryList.length > 0 && <div><span className="text-ink-muted">Categories: </span>{p.categoryList.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={urls.get(c.id)!} className="font-medium hover:text-primary">{c.name}</Link></span>)}</div>}
            {p.tagList.length > 0 && <div><span className="text-ink-muted">Tag: </span>{p.tagList.map((t, i) => <span key={t.id}>{i > 0 && ", "}<Link href={`/product-tag/${t.slug}/`} className="font-medium hover:text-primary">{t.name}</Link></span>)}</div>}
            {p.brandList.length > 0 && <div><span className="text-ink-muted">Brand: </span>{p.brandList.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link href={`/brand/${b.slug}/`} className="font-medium hover:text-primary">{b.name}</Link></span>)}</div>}
          </div>
          <div className="mt-5 flex gap-2">
            {site.shareNetworks.map((n) => share[n] && (
              <a key={n} href={share[n]} target="_blank" rel="noopener" aria-label={`Share on ${n}`} className={`flex h-7 w-7 items-center justify-center rounded-full border ${n === "whatsapp" ? "border-success text-success" : "border-primary text-primary"} hover:opacity-70`}><Icon name={n} size={14} /></a>
            ))}
          </div>
        </div>
      </div>

      <ProductTabs tabs={[
        ...(stripHtml(p.description) ? [{ key: "description", label: "Description", content: <div className="prose-lb text-ink" dangerouslySetInnerHTML={{ __html: p.description! }} /> }] : []),
        ...(stripHtml(p.specification) || p.attributes?.length ? [{ key: "specifications", label: "Specifications", content: <>
          {stripHtml(p.specification) && <div className="prose-lb" dangerouslySetInnerHTML={{ __html: p.specification! }} />}
          {p.attributes && p.attributes.length > 0 && (
            <table className="mt-4 w-full border-collapse text-sm">
              <tbody>{p.attributes.map((a) => <tr key={a.name}><th className="w-1/3 border border-line bg-surface px-3 py-2 text-left font-medium">{a.name}</th><td className="border border-line px-3 py-2">{a.values.join(", ")}</td></tr>)}</tbody>
            </table>
          )}
        </> }] : []),
        { key: "reviews", label: `Reviews (${rev.count})`, content: <Reviews productId={p.id} count={rev.count} avg={rev.avg} dist={rev.dist}
          reviews={rev.reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} user={user ? { name: user.displayName || user.firstName || user.email } : null} /> },
      ]} />

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-semibold">Related products</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
    </div>
  );
}
