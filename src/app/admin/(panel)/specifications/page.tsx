import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { descendantIds, getAllCategories } from "@/lib/catalog";
import { specSummary } from "@/lib/spec-tables";
import { prisma, Prisma } from "@/lib/prisma";
import { PageHeader, Badge, Table, th, td, Empty, FlashToast } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { SpecQuickEdit } from "@/components/admin/SpecQuickEdit";
import { Pagination } from "@/components/store/ShopView";
import { saveSpecification, moveProductTables } from "./actions";

export const metadata = { title: "Specifications" };
export const dynamic = "force-dynamic";

type SP = { tab?: string; q?: string; cat?: string; page?: string; stock?: string };
type Row = {
  id: number; name: string; sku: string | null; slug: string; status: string; stockStatus: string; image: string | null; category: string | null;
  specification: string | null; attrCount: number; descTable: boolean;
};
type Kind = "missing" | "description" | "attributes" | "complete";

const TABS: { v: Kind | "all"; label: string; hint: string }[] = [
  { v: "missing", label: "No specifications", hint: "Nothing in the Specifications tab. Add a table, copy one from a similar product, or check the supplier’s data sheet." },
  { v: "description", label: "Table in description", hint: "The spec table sits inside the description. Move it to the Specifications tab with one click." },
  { v: "attributes", label: "Attributes only", hint: "Only short attributes (e.g. colour) show in the Specifications tab. A full table would help buyers compare." },
  { v: "complete", label: "Has specifications", hint: "Products with a specification table. Check them for missing rows or outdated values." },
  { v: "all", label: "All", hint: "" },
];

const kindOf = (r: Row): Kind => {
  if (r.descTable) return "description";
  if (specSummary(r.specification).hasText) return "complete";
  return r.attrCount > 0 ? "attributes" : "missing";
};

export default async function Specifications({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff(); // layouts can be skipped on partial requests: every page must check for itself
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.v === sp.tab) ? sp.tab : "missing") as Kind | "all";
  const per = 40; const page = Math.max(1, Number(sp.page || 1));

  const where: Prisma.Sql[] = [Prisma.sql`p.status <> 'trash'`];
  if (sp.q?.trim()) { const like = `%${sp.q.trim().replace(/[\\%_]/g, "\\$&")}%`; where.push(Prisma.sql`(p.name ILIKE ${like} OR p.sku ILIKE ${like})`); }
  if (sp.cat) where.push(Prisma.sql`p.id IN (SELECT product_id FROM product_categories WHERE category_id IN (${Prisma.join(await descendantIds([Number(sp.cat)]))}))`);
  if (sp.stock === "instock") where.push(Prisma.sql`p.stock_status <> 'outofstock'`);

  const [all, cats] = await Promise.all([
    prisma.$queryRaw<Row[]>`SELECT p.id, p.name, p.sku, p.slug, p.status, p.stock_status AS "stockStatus", m.url AS image, c.name AS category, p.specification,
        COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.attributes) = 'array' THEN p.attributes END), 0)::int AS "attrCount",
        (COALESCE(p.description, '') ILIKE '%<table%') AS "descTable"
      FROM products p LEFT JOIN media m ON m.id = p.image_id LEFT JOIN categories c ON c.id = p.primary_category_id
      WHERE ${Prisma.join(where, " AND ")} ORDER BY p.name ASC`,
    getAllCategories(),
  ]);

  const counts: Record<string, number> = { all: all.length, missing: 0, description: 0, attributes: 0, complete: 0 };
  const withKind = all.map((r) => { const k = kindOf(r); counts[k]++; return { r, k }; });
  const list = tab === "all" ? withKind : withKind.filter((x) => x.k === tab);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const shown = list.slice((page - 1) * per, page * per);

  const keep = (over: Partial<SP>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: sp.tab, q: sp.q, cat: sp.cat, stock: sp.stock, ...over })) if (v) u.set(k, v);
    return u.toString();
  };
  const qs = keep({ page: page > 1 ? String(page) : undefined });
  const total = all.length;
  const done = counts.complete;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (<>
    <FlashToast />
    <PageHeader title="Specifications" subtitle="Which products have a specification table, which don’t, and quick editing for each." />

    <div className="mb-5 rounded-base border border-line bg-white p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span><strong className="text-lg">{done}</strong> of {total} products have a specification table{sp.q || sp.cat || sp.stock ? " (with these filters)" : ""}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
        <div className="bg-success" style={{ width: `${(counts.complete / Math.max(1, total)) * 100}%` }} title="Has specifications" />
        <div className="bg-amber-400" style={{ width: `${(counts.description / Math.max(1, total)) * 100}%` }} title="Table in description" />
        <div className="bg-sky-300" style={{ width: `${(counts.attributes / Math.max(1, total)) * 100}%` }} title="Attributes only" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-success" />Has specifications {counts.complete}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Table in description {counts.description}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-300" />Attributes only {counts.attributes}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-surface ring-1 ring-line" />None {counts.missing}</span>
      </div>
    </div>

    <nav className="mb-3 flex flex-wrap gap-1 text-sm">
      {TABS.map((t) => (
        <Link key={t.v} href={`/admin/specifications/?${keep({ tab: t.v === "missing" ? undefined : t.v, page: undefined })}`}
          className={`rounded-form px-3 py-1.5 font-medium ${tab === t.v ? "bg-ink text-white" : "text-ink-soft hover:bg-surface"}`}>
          {t.label} <span className="opacity-70">({counts[t.v]})</span>
        </Link>
      ))}
    </nav>
    {TABS.find((t) => t.v === tab)?.hint && <p className="mb-3 text-sm text-ink-soft">{TABS.find((t) => t.v === tab)!.hint}</p>}

    <form className="mb-4 flex flex-wrap gap-2">
      {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
      <input name="q" defaultValue={sp.q} placeholder="Search name or SKU…" className="field h-10 w-60 text-sm" />
      <select name="cat" defaultValue={sp.cat} className="field h-10 w-56 text-sm"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}</select>
      <select name="stock" defaultValue={sp.stock} className="field h-10 w-44 text-sm"><option value="">In stock or not</option><option value="instock">In stock only</option></select>
      <button className="btn-outline h-10 text-sm">Filter</button>
      {(sp.q || sp.cat || sp.stock) && <Link href={`/admin/specifications/?${keep({ q: undefined, cat: undefined, stock: undefined, page: undefined })}`} className="self-center text-sm text-ink-soft hover:underline">Reset</Link>}
    </form>

    {shown.length === 0 ? <Empty>{tab === "missing" ? "Every product here has specifications. 🎉" : "No products here."}</Empty> : (
      <Table head={<><th className={th} colSpan={2}>Product</th><th className={th}>Category</th><th className={th}>Specifications</th><th className={`${th} text-right`}>Actions</th></>}>
        {shown.map(({ r, k }) => {
          const s = specSummary(r.specification);
          return (
            <tr key={r.id} className="align-top hover:bg-surface/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <td className={`${td} w-14`}>{r.image ? <img src={r.image} alt="" className="h-11 w-11 rounded border border-line object-contain" /> : <div className="h-11 w-11 rounded bg-surface" />}</td>
              <td className={td}>
                <Link href={`/admin/products/${r.id}/`} className="font-semibold hover:text-primary">{r.name}</Link>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-ink-muted">
                  {r.sku && <span>{r.sku}</span>}
                  {r.status !== "published" && <span className="text-amber-600">{r.status}</span>}
                  {r.stockStatus === "outofstock" && <span className="text-danger">Out of stock</span>}
                  <a href={`/product/${r.slug}/#specifications`} target="_blank" className="hover:text-primary">View</a>
                </div>
              </td>
              <td className={`${td} text-sm text-ink-soft`}>{r.category || "–"}</td>
              <td className={`${td} max-w-[420px] text-sm`}>
                {k === "complete" && <><Badge className="bg-green-100 text-green-800">{s.rows ? `${s.rows} rows` : "Text"}</Badge><div className="mt-1 line-clamp-2 text-xs text-ink-soft">{s.preview}</div></>}
                {k === "description" && <><Badge className="bg-amber-100 text-amber-800">Table in description</Badge>{s.hasText && <div className="mt-1 text-xs text-ink-soft">Also has {s.rows || "some"} spec rows already</div>}</>}
                {k === "attributes" && <Badge className="bg-sky-100 text-sky-800">{r.attrCount} attribute{r.attrCount === 1 ? "" : "s"} only</Badge>}
                {k === "missing" && <Badge className="bg-gray-100 text-gray-600">None</Badge>}
                {k !== "description" && r.attrCount > 0 && k !== "attributes" && <div className="mt-1 text-xs text-ink-muted">+ {r.attrCount} attribute{r.attrCount === 1 ? "" : "s"}</div>}
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <div className="flex justify-end gap-2">
                  {k === "description" && (
                    <form action={moveProductTables}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="qs" value={qs} />
                      <SubmitButton className="btn-primary h-8 px-3 text-xs" pendingText="Moving…">Move table</SubmitButton></form>
                  )}
                  <SpecQuickEdit id={r.id} name={r.name} initial={r.specification ?? ""} qs={qs} action={saveSpecification} label={k === "complete" ? "Edit" : "Add specs"} />
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    )}
    <Pagination page={page} pages={pages} href={(n) => `/admin/specifications/?${keep({ page: n > 1 ? String(n) : undefined })}`} />
  </>);
}
