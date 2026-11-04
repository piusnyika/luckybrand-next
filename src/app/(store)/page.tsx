import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSetting, getSite, type HomepageSettings } from "@/lib/settings";
import { jsonLd } from "@/lib/format";
import { listProducts } from "@/lib/catalog";
import { HeroSlider } from "@/components/store/HeroSlider";
import { Carousel } from "@/components/store/Carousel";
import { ProductCell } from "@/components/store/ProductCard";
import { SectionHeader } from "@/components/store/SectionHeader";
import { Icon } from "@/components/Icon";

export const revalidate = 300;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (sp.s !== undefined) redirect(`/shop/?s=${encodeURIComponent(sp.s)}`); // old WordPress search URLs
  const [home, site] = await Promise.all([getSetting<HomepageSettings>("homepage"), getSite()]);
  const base = process.env.SITE_URL || "";
  // who we are (Google's knowledge panel) and the search box Google can show under the site in results
  const ld = [
    { "@context": "https://schema.org", "@type": "Store", name: site.name, url: base + "/", ...(site.logo ? { logo: base + site.logo, image: base + site.logo } : {}),
      ...(site.email ? { email: site.email } : {}), ...(site.phones[0] ? { telephone: site.phones[0].tel } : {}),
      ...(site.address ? { address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "ZW" } } : {}),
      sameAs: site.social.map((s) => s.url).filter(Boolean) },
    { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: base + "/",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/shop/?s={search_term_string}` }, "query-input": "required name=search_term_string" } },
  ];

  const sections = await Promise.all(home.sections.map(async (sec) => {
    if (sec.type === "promo-banner") return { sec, items: [] };
    const sort = sec.source === "random" ? "random" : sec.source === "best_selling" ? "popularity" : "latest";
    const r = await listProducts({ categoryIds: sec.categoryIds, featured: sec.source === "featured", onSale: sec.source === "on_sale", inStock: sec.hideOutOfStock, sort, perPage: sec.limit || 12 });
    return { sec, items: r.items };
  }));

  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <div className="grid gap-[30px] pt-5 lg:grid-cols-[270px_1fr] lg:pt-[30px]">
        <div className="hidden lg:block" />
        <HeroSlider slides={home.slides} />
      </div>

      {sections.map(({ sec, items }, k) => {
        if (sec.type === "promo-banner") {
          return (
            <section key={k} className="mt-10 lg:mt-12">
              <div className="flex flex-col items-center gap-4 overflow-hidden rounded-base px-6 py-6 text-white sm:flex-row sm:px-10" style={{ background: sec.background }}>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl font-semibold lg:text-[22px]">{sec.title}</h3>
                  <div className="mt-1 text-sm [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: sec.html }} />
                </div>
                {sec.image && <div className="relative h-16 w-48 shrink-0 sm:h-20 sm:w-64"><Image src={sec.image} alt="" fill sizes="256px" className="object-contain" /></div>}
                <Link href={sec.link || "/shop/"} className="flex items-center gap-2 rounded-form bg-white px-5 py-2.5 text-sm font-semibold text-brand">{sec.buttonLabel} <Icon name="arrowRight" size={16} /></Link>
              </div>
            </section>
          );
        }
        if (!items.length) return null;
        return (
          <section key={k} className="mt-10 lg:mt-12">
            <SectionHeader title={sec.title} link={sec.link || "/shop/"} linkLabel={sec.linkLabel} />
            {sec.banner?.image && (
              <Link href={sec.banner.link || "/shop/"} className="relative mb-5 block aspect-[1360/260] overflow-hidden rounded-base">
                <Image src={sec.banner.image} alt={sec.banner.title || ""} fill sizes="100vw" className="object-cover" />
              </Link>
            )}
            {sec.type === "product-carousel" ? (
              <Carousel>
                {items.map((p) => <div key={p.id} className="w-1/2 shrink-0 snap-start border-r border-line sm:w-1/3 lg:w-1/6">
                  <ProductCell p={p} /></div>)}
              </Carousel>
            ) : (
              <div className="grid grid-cols-2 overflow-hidden rounded-base border-l border-t border-line sm:grid-cols-3 lg:grid-cols-6">
                {items.map((p) => <div key={p.id} className="border-b border-r border-line"><ProductCell p={p} /></div>)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
