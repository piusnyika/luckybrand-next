import { requireStaff } from "@/lib/auth";
import { analyzeProduct, gradeColor } from "@/lib/seo-score";
import { getSite } from "@/lib/settings";
import Link from "next/link";
import { descendantIds, getAllCategories, effectivePrice } from "@/lib/catalog";
import { money } from "@/lib/format";
import { PageHeader, Badge, Table, th, td, Empty, FlashToast } from "@/components/admin/ui";
import { Pagination } from "@/components/store/ShopView";
import { bulkProducts, moveAllDescriptionTables, undoMoveDescriptionTables, keepMovedDescriptionTables } from "./actions";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { BulkBar } from "@/components/admin/BulkBar";
import { purgeExpiredTrash, TRASH_DAYS } from "@/lib/admin/product-trash";
import { prisma, Prisma } from "@/lib/prisma";

export const metadata = { title: "Products" };
type SP = { q?: string; cat?: string; status?: string; stock?: string; sort?: string; page?: string };

export default async function Products({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams; const page = Math.max(1, Number(sp.page || 1)); const per = 30;
  await purgeExpiredTrash();
  const inTrash = sp.status === "trash";
  const where: Prisma.ProductWhereInput[] = [];
  if (sp.q) where.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }] });
  if (sp.status === "published" || sp.status === "draft" || sp.status === "trash") where.push({ status: sp.status });
  else where.push({ status: { not: "trash" } });
  if (sp.stock === "outofstock" || sp.stock === "instock" || sp.stock === "onbackorder") where.push({ stockStatus: sp.stock });
  if (sp.stock === "low") where.push({ id: { in: (await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM products WHERE manage_stock AND stock_qty <= COALESCE(low_stock_amount, 2)`).map((r) => r.id) } });
  if (sp.cat) where.push({ categories: { some: { categoryId: { in: await descendantIds([Number(sp.cat)]) } } } });
  const orders: Record<string, Prisma.ProductOrderByWithRelationInput> = { name: { name: "asc" }, price: { regularPrice: "asc" }, "price-desc": { regularPrice: "desc" }, sales: { totalSales: "desc" }, stock: { stockQty: { sort: "asc", nulls: "first" } } };
  const order = orders[sp.sort || ""] ?? { id: "desc" };
  const cond: Prisma.ProductWhereInput = { AND: where };
  const titleSuffix = ` – ${(await getSite()).name}`;
  const [rows, total, cats, statusCounts] = await Promise.all([
    prisma.product.findMany({ where: cond, orderBy: order, take: per, skip: (page - 1) * per, include: { image: { select: { url: true } }, primaryCategory: { select: { name: true } }, _count: { select: { images: true, categories: true } } } })
      .then((r) => r.map(({ image, primaryCategory, ...p }) => ({ p, image: image?.url ?? null, cat: primaryCategory?.name ?? null }))),
    prisma.product.count({ where: cond }), getAllCategories(),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (st: string) => statusCounts.find((c) => c.status === st)?._count._all ?? 0;
  const tabs: [string, string, number][] = [["", "All", count("published") + count("draft")], ["published", "Published", count("published")], ["draft", "Drafts", count("draft")], ["trash", "Trash", count("trash")]];
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const pages = Math.ceil(Number(total) / per);
  // tidy-up banner: tables sitting in descriptions, or a recent move that can still be undone
  const [withTables, tablesBackup] = await Promise.all([
    prisma.product.count({ where: { status: { not: "trash" }, description: { contains: "<table", mode: "insensitive" } } }),
    prisma.setting.findUnique({ where: { key: "specTablesBackup" } }),
  ]);
  const backupInfo = tablesBackup?.value as { at: string; items: unknown[] } | undefined;
  return (
    <>
      <FlashToast />
      <PageHeader title="Products" subtitle={`${total} products`} actions={<>
        <Link href="/admin/products/import/" className="btn-outline h-10 text-sm">Import / export</Link>
        <Link href="/admin/products/new/" className="btn-primary h-10 text-sm">+ Add product</Link>
      </>} />
      {backupInfo?.items?.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-base border border-green-200 bg-green-50 px-4 py-3 text-sm">
          <span className="flex-1">Tables were moved from descriptions to Specifications in <strong>{backupInfo.items.length} products</strong> on {new Date(backupInfo.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Check a few products in the store, then keep or undo.</span>
          <form action={undoMoveDescriptionTables}><ConfirmButton message="Put all those descriptions and specifications back as they were?" className="btn-outline h-9 bg-white text-sm">Undo</ConfirmButton></form>
          <form action={keepMovedDescriptionTables}><SubmitButton className="btn-primary h-9 text-sm" pendingText="…">Keep</SubmitButton></form>
        </div>
      ) : withTables > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span className="flex-1"><strong>{withTables} products</strong> have a table inside their description. Move them to each product’s <strong>Specifications</strong> tab, where they read better? You can undo this afterwards.</span>
          <form action={moveAllDescriptionTables}><ConfirmButton message={`Move the description tables of ${withTables} products to Specifications? You can undo this afterwards.`} className="btn-primary h-9 text-sm">Move tables to Specifications</ConfirmButton></form>
        </div>
      ) : null}
      <nav className="mb-3 flex flex-wrap gap-1 text-sm">
        {tabs.map(([v, label, n]) => (
          <Link key={v} href={v ? `/admin/products/?status=${v}` : "/admin/products/"}
            className={`rounded-form px-3 py-1.5 font-medium ${(sp.status ?? "") === v ? "bg-ink text-white" : "text-ink-soft hover:bg-surface"}`}>
            {label} <span className="opacity-70">({n})</span>
          </Link>
        ))}
      </nav>
      {inTrash && <p className="mb-3 text-sm text-ink-soft">Products in the trash are hidden from the store and deleted permanently after {TRASH_DAYS} days.</p>}
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search name or SKU…" className="field h-10 w-60 text-sm" />
        <select name="cat" defaultValue={sp.cat} className="field h-10 w-52 text-sm"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}</select>
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <select name="stock" defaultValue={sp.stock} className="field h-10 w-40 text-sm"><option value="">Any stock</option><option value="instock">In stock</option><option value="outofstock">Out of stock</option><option value="onbackorder">Backorder</option><option value="low">Low stock</option></select>
        <select name="sort" defaultValue={sp.sort} className="field h-10 w-40 text-sm"><option value="">Newest</option><option value="name">Name A–Z</option><option value="price">Price ↑</option><option value="price-desc">Price ↓</option><option value="sales">Best selling</option><option value="stock">Stock ↑</option></select>
        <button className="btn-outline h-10 text-sm">Filter</button>
        {qs.toString() && <Link href="/admin/products/" className="self-center text-sm text-ink-soft hover:underline">Reset</Link>}
      </form>
      {rows.length === 0 ? <Empty>{inTrash ? "The trash is empty." : "No products found."}</Empty> : (
        <form action={bulkProducts}>
          <input type="hidden" name="qs" value={qs.toString()} />
          <BulkBar options={inTrash ? [["restore", "Restore"], ["delete", "Delete permanently"]]
            : [["publish", "Publish"], ["draft", "Set to draft"], ["instock", "Mark in stock"], ["outofstock", "Mark out of stock"], ["feature", "Feature"], ["unfeature", "Unfeature"], ["trash", "Move to trash"]]} />
          <Table head={<><th className={`${th} w-8`}><input type="checkbox" data-select-all className="accent-primary" aria-label="Select all" /></th><th className={th} colSpan={2}>Product</th><th className={th}>SKU</th><th className={th}>Stock</th><th className={th}>Price</th><th className={th}>Category</th><th className={th} title="SEO score out of 100">SEO</th><th className={th}>Status</th></>}>
            {rows.map(({ p, image, cat }) => {
              const pr = effectivePrice(p);
              return (
                <tr key={p.id} className="hover:bg-surface/60">
                  <td className={td}><input type="checkbox" name="sel" value={p.id} className="accent-primary" aria-label={`Select ${p.name}`} /></td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td className={`${td} w-14`}>{image ? <img src={image} alt="" className="h-11 w-11 rounded border border-line object-contain" /> : <div className="h-11 w-11 rounded bg-surface" />}</td>
                  <td className={td}><Link href={`/admin/products/${p.id}/`} className="font-semibold hover:text-primary">{p.name}</Link>{p.featured && <span className="ml-2 text-amber-500" title="Featured">★</span>}{p.type === "bundle" && <Badge className="ml-2 bg-indigo-100 text-indigo-800">Bundle</Badge>}
                    <div className="mt-0.5 flex gap-3 text-xs text-ink-muted"><span>ID {p.id}</span><a href={`/product/${p.slug}/`} target="_blank" className="hover:text-primary">View</a></div></td>
                  <td className={`${td} text-ink-soft`}>{p.sku || "–"}</td>
                  <td className={td}><span className={p.stockStatus === "outofstock" ? "text-danger" : p.stockStatus === "onbackorder" ? "text-amber-600" : "text-success"}>{p.stockStatus === "outofstock" ? "Out of stock" : p.stockStatus === "onbackorder" ? "Backorder" : "In stock"}</span>{p.manageStock && <span className="text-ink-muted"> ({p.stockQty})</span>}</td>
                  <td className={td}>{pr.onSale ? <><del className="text-xs text-ink-muted">{money(pr.regularPrice)}</del> {money(pr.price)}</> : money(pr.price)}</td>
                  <td className={`${td} text-ink-soft`}>{cat || "–"}</td>
                  <td className={td}>{(() => { const s = analyzeProduct({ name: p.name, slug: p.slug, seoTitle: p.seoTitle, seoDescription: p.seoDescription ?? "", focusKeyword: p.focusKeyword,
                    shortDescription: p.shortDescription ?? "", description: p.description ?? "", specification: p.specification ?? "", attributeCount: p.attributes?.length ?? 0,
                    imageCount: Math.max(p._count.images, p.imageId ? 1 : 0), imagesWithoutAlt: 0, categoryCount: p._count.categories, titleSuffix });
                    return <Link href={`/admin/products/${p.id}/#seo`} title={s.checks.find((c) => c.status === "bad")?.tip ?? "SEO score"}><Badge className={gradeColor(s.grade)}>{s.score}</Badge></Link>; })()}</td>
                  <td className={td}>{p.status === "published" ? <Badge className="bg-green-100 text-green-800">Published</Badge> : p.status === "trash" ? <>
                    <Badge className="bg-red-100 text-red-700">Trash</Badge>
                    {p.trashedAt && <div className="mt-1 text-xs text-ink-muted">Deleted for good in {Math.max(0, TRASH_DAYS - Math.floor((Date.now() - p.trashedAt.getTime()) / 86_400_000))} days</div>}
                  </> : <Badge>Draft</Badge>}</td>
                </tr>
              );
            })}
          </Table>
        </form>
      )}
      <Pagination page={page} pages={pages} href={(n) => `/admin/products/?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(n) })}`} />
    </>
  );
}
