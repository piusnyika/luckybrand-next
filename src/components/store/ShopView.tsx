import Link from "next/link";
import { listProducts, getCategoryTree, priceRange, categoryUrlMap, type Category, type ListParams } from "@/lib/catalog";
import { ProductCard, ProductRow } from "./ProductCard";
import { Breadcrumbs } from "./Breadcrumbs";
import { ShopToolbar } from "./ShopToolbar";
import { PriceFilter } from "./PriceFilter";
import { MobileFilters } from "./MobileFilters";
import { Icon } from "../Icon";
import { logSearch } from "@/lib/search";
import { getSite, salesContactsOf } from "@/lib/settings";

export type ShopSearchParams = Record<string, string | undefined>;

export async function ShopView({
  title, intro, basePath, breadcrumbs, filter, sp, activeCategoryIds = [], page: pageOverride,
}: {
  title: string; intro?: string | null; basePath: string; breadcrumbs: { label: string; href?: string }[];
  filter: Pick<ListParams, "categoryIds" | "brandId" | "tagId">; sp: ShopSearchParams; activeCategoryIds?: number[]; page?: number;
}) {
  const search = sp.s?.trim() || undefined;
  const defaultSort = search ? "relevance" : "date";
  const orderby = sp.orderby || defaultSort;
  const sortMap: Record<string, ListParams["sort"]> = { relevance: "relevance", date: "latest", price: "price", "price-desc": "price-desc", popularity: "popularity", rating: "popularity", menu_order: "latest" };
  const perPage = [12, 20, 30, 40, 60].includes(Number(sp.per_page)) ? Number(sp.per_page) : 20;
  const page = pageOverride ?? Math.max(1, Number(sp.paged || sp.page || 1));
  const params: ListParams = {
    ...filter, search, sort: sortMap[orderby] ?? "latest", page, perPage,
    inStock: sp.stock_status === "instock", onSale: sp.on_sale === "1",
    minPrice: sp.min_price ? Number(sp.min_price) : undefined, maxPrice: sp.max_price ? Number(sp.max_price) : undefined,
  };
  const [res, tree, range, urls, site] = await Promise.all([listProducts(params), getCategoryTree(), priceRange(filter.categoryIds), categoryUrlMap(), getSite()]);
  // count each submitted search once (first page, no extra filters) for Admin → Search
  if (search && page === 1 && !sp.orderby && !sp.stock_status && !sp.on_sale && !sp.min_price && !sp.max_price) await logSearch(search, res.partial ? 0 : res.total);
  const wa = (site.whatsapp || salesContactsOf(site)[0]?.phone || "").replace(/\D/g, "").replace(/^0/, "263");
  const view = sp.view === "list" ? "list" : "grid";
  const from = res.total ? (page - 1) * perPage + 1 : 0, to = Math.min(res.total, page * perPage);

  const qs = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v !== undefined && v !== "" && k !== "page") u.set(k, v);
    const str = u.toString(); return basePath + (str ? "?" + str : "");
  };

  const sidebar = (
    <div className="space-y-8">
      <div>
        <h4 className="mb-4 text-[15px] font-semibold">Product Categories</h4>
        <CatList nodes={tree} urls={urls} active={activeCategoryIds} />
      </div>
      <div>
        <h4 className="mb-4 text-[15px] font-semibold">Filter by price</h4>
        <PriceFilter min={range.min} max={range.max} curMin={sp.min_price} curMax={sp.max_price} />
      </div>
      <div>
        <h4 className="mb-4 text-[15px] font-semibold">Product Status</h4>
        <FilterCheck href={qs({ stock_status: sp.stock_status === "instock" ? undefined : "instock", paged: undefined })} on={sp.stock_status === "instock"} label="In Stock" />
        <FilterCheck href={qs({ on_sale: sp.on_sale === "1" ? undefined : "1", paged: undefined })} on={sp.on_sale === "1"} label="On Sale" />
      </div>
    </div>
  );

  return (
    <div className="container">
      <Breadcrumbs items={breadcrumbs} />
      {intro ? <div className="prose-lb mb-4 text-sm text-ink" dangerouslySetInnerHTML={{ __html: intro }} /> : null}
      {sp.s && <h1 className="mb-4 text-2xl font-semibold">Search results: “{sp.s}”</h1>}
      {!sp.s && !intro && <h1 className="sr-only">{title}</h1>}
      <div className="grid gap-8 lg:grid-cols-[255px_1fr]">
        <aside className="hidden border-r border-line pr-8 lg:block">{sidebar}</aside>
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MobileFilters>{sidebar}</MobileFilters>
              <span className="text-xs text-ink-muted">Showing {from}–{to} of {res.total} results</span>
            </div>
            <ShopToolbar orderby={orderby} defaultSort={defaultSort} perPage={perPage} view={view} />
          </div>
          {search && res.partial && res.items.length > 0 && (
            <div className="mb-5 rounded-base border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
              No product matches all of “{search}”. These are the closest matches. Can’t find it?{" "}
              {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I'm looking for: ${search}`)}`} target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">Ask us on WhatsApp</a>}
              {wa && " or "}<Link href="/request-a-quote/" className="font-semibold text-primary hover:underline">request a quote</Link>.
            </div>
          )}
          {res.items.length === 0 ? (
            <div className="rounded-base border border-line bg-surface p-10 text-center text-ink-soft">
              {search ? (<>
                <div className="text-base font-semibold text-ink">No products found for “{search}”</div>
                <p className="mx-auto mt-2 max-w-[440px] text-sm">Check the spelling or try a more general word (for example “generator” instead of a model number). We also stock and source equipment that isn’t listed online, so just ask.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I'm looking for: ${search}`)}`} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-2 rounded-form bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"><Icon name="whatsapp" size={16} />Ask on WhatsApp</a>}
                  <Link href="/request-a-quote/" className="inline-flex items-center gap-2 rounded-form border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary"><Icon name="edit" size={16} />Request a quote</Link>
                </div>
              </>) : "No products were found matching your selection."}
            </div>
          ) : view === "list" ? (
            <div className="space-y-4">{res.items.map((p) => <ProductRow key={p.id} p={p} />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">{res.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          )}
          <Pagination page={page} pages={res.pages} href={(n) => qs({ paged: n === 1 ? undefined : String(n) })} />
        </div>
      </div>
    </div>
  );
}

function CatList({ nodes, urls, active, depth = 0 }: { nodes: Category[]; urls: Map<number, string>; active: number[]; depth?: number }) {
  const isOpen = (c: Category): boolean => active.includes(c.id) || (c.children ?? []).some(isOpen);
  return (
    <ul className={depth ? "ml-6 mt-1" : ""}>
      {nodes.filter((c) => (c.count ?? 0) > 0 || (c.children ?? []).length).map((c) => (
        <li key={c.id}>
          <div className="flex items-center justify-between py-[5px]">
            <Link href={urls.get(c.id)!} className="flex items-center gap-2.5 text-[13px] text-ink-soft hover:text-primary">
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${active.includes(c.id) ? "border-primary bg-primary text-white" : "border-[#c7ccd1]"}`}>
                {active.includes(c.id) && <Icon name="check" size={11} strokeWidth={3} />}
              </span>
              {c.name}
            </Link>
            {(c.children ?? []).length > 0 && <span className="text-xs text-ink-muted">{isOpen(c) ? "−" : "+"}</span>}
          </div>
          {(c.children ?? []).length > 0 && isOpen(c) && <CatList nodes={c.children!} urls={urls} active={active} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

function FilterCheck({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 py-[5px] text-[13px] text-ink-soft hover:text-primary" scroll={false}>
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-primary bg-primary text-white" : "border-[#c7ccd1]"}`}>{on && <Icon name="check" size={11} strokeWidth={3} />}</span>{label}
    </Link>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages < 2) return null;
  const nums: (number | "…")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const cls = "flex h-9 min-w-9 items-center justify-center rounded-[5px] px-2 text-sm font-medium";
  return (
    <nav className="mt-10 flex flex-wrap justify-center gap-2" aria-label="Pagination">
      {page > 1 && <Link href={href(page - 1)} className={`${cls} hover:bg-surface`} aria-label="Previous page"><Icon name="chevronLeft" size={16} /></Link>}
      {nums.map((n, i) => n === "…" ? <span key={i} className={cls}>…</span> :
        <Link key={i} href={href(n)} className={`${cls} ${n === page ? "bg-primary text-white" : "hover:bg-surface"}`} aria-current={n === page ? "page" : undefined}>{n}</Link>)}
      {page < pages && <Link href={href(page + 1)} className={`${cls} hover:bg-surface`} aria-label="Next page"><Icon name="chevronRight" size={16} /></Link>}
    </nav>
  );
}
