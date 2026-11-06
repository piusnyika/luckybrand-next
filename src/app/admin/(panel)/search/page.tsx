import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { getSetting, type SearchSettings } from "@/lib/settings";
import { searchProducts } from "@/lib/search";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Table, th, td, Empty, SubmitButton, ConfirmButton, FlashToast, Badge } from "@/components/admin/ui";
import { saveSearchSettings, deleteSearchTerm, clearSearchTerms } from "./actions";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

type Row = { id: number; term: string; searches: number; lastResults: number; lastAt: Date };

const when = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function SearchAdmin({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  await requireStaff();
  const { test } = await searchParams;
  const [settings, none, top, [{ total }]] = await Promise.all([
    getSetting<SearchSettings>("search"),
    prisma.$queryRaw<Row[]>`SELECT id, term, searches, last_results AS "lastResults", last_at AS "lastAt" FROM search_terms
      WHERE last_results = 0 ORDER BY searches DESC, last_at DESC LIMIT 100`,
    prisma.$queryRaw<Row[]>`SELECT id, term, searches, last_results AS "lastResults", last_at AS "lastAt" FROM search_terms
      WHERE last_results > 0 ORDER BY searches DESC, last_at DESC LIMIT 40`,
    prisma.$queryRaw<{ total: number }[]>`SELECT COALESCE(SUM(searches), 0)::int AS total FROM search_terms`,
  ]);

  let testResult: { names: { id: number; name: string; status: string }[]; count: number; partial: boolean } | null = null;
  if (test?.trim()) {
    const r = await searchProducts(test);
    const top10 = r.ids.slice(0, 10);
    const rows = await prisma.product.findMany({ where: { id: { in: top10 } }, select: { id: true, name: true, status: true } });
    const byId = new Map(rows.map((p) => [p.id, p]));
    testResult = { names: top10.map((i) => byId.get(i)!).filter(Boolean), count: r.ids.length, partial: r.partial };
  }

  const termRow = (r: Row) => (
    <tr key={r.id}>
      <td className={`${td} font-medium`}>{r.term}</td>
      <td className={td}>{r.searches}</td>
      {r.lastResults > 0 && <td className={td}>{r.lastResults}</td>}
      <td className={`${td} text-xs text-ink-soft`}>{when(r.lastAt)}</td>
      <td className={`${td} whitespace-nowrap text-right text-xs`}>
        <Link href={`/admin/search/?test=${encodeURIComponent(r.term)}#test`} className="mr-3 text-primary hover:underline">Test</Link>
        <Link href={`/shop/?s=${encodeURIComponent(r.term)}`} target="_blank" className="mr-3 text-primary hover:underline">View in shop</Link>
        <form action={deleteSearchTerm} className="inline"><input type="hidden" name="id" value={r.id} /><button className="text-danger hover:underline">Remove</button></form>
      </td>
    </tr>
  );

  return (<>
    <FlashToast />
    <PageHeader title="Search" subtitle={<>What shoppers search for, and words that should find the same products. {total.toLocaleString()} searches recorded.</>} />

    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Searches that found nothing" actions={none.length > 0 && (
        <form action={clearSearchTerms}><input type="hidden" name="which" value="none" /><ConfirmButton message="Clear the list of searches that found nothing?" className="text-xs text-danger">Clear list</ConfirmButton></form>
      )}>
        <p className="mb-4 text-sm text-ink-soft">
          Products people want but couldn’t find. Either you don’t stock them (a buying idea) or they’re named differently: add the shopper’s word
          as a synonym below, or to the product’s name or tags.
        </p>
        {none.length === 0 ? <Empty>No failed searches yet.</Empty> : (
          <Table head={<><th className={th}>Search</th><th className={th}>Times</th><th className={th}>Last</th><th className={th} /></>}>{none.map(termRow)}</Table>
        )}
      </Card>

      <Card title="Most searched" actions={(none.length > 0 || top.length > 0) && (
        <form action={clearSearchTerms}><input type="hidden" name="which" value="all" /><ConfirmButton message="Delete the whole search log?" className="text-xs text-danger">Clear all</ConfirmButton></form>
      )}>
        <p className="mb-4 text-sm text-ink-soft">Popular searches that found products. Useful for homepage sections, stock levels and ads.</p>
        {top.length === 0 ? <Empty>No searches yet.</Empty> : (
          <Table head={<><th className={th}>Search</th><th className={th}>Times</th><th className={th}>Results</th><th className={th}>Last</th><th className={th} /></>}>{top.map(termRow)}</Table>
        )}
      </Card>
    </div>

    <div id="test" className="mt-6 grid gap-6 xl:grid-cols-2">
      <Card title="Synonyms and settings">
        <form action={saveSearchSettings} className="space-y-4">
          <Field label="Search box text" hint="Shown in the empty search box in the header.">
            <input name="placeholder" defaultValue={settings.placeholder} maxLength={80} className="field" />
          </Field>
          <Field label="Synonyms" hint={<>One group per line, separated by commas. Every word in a group finds the products of the others, e.g. <code>borehole, submersible</code>. Phrases work too: <code>geyser, water heater</code>. Plurals, spelling mistakes and sizes (10kva = 10 kVA) are handled automatically, so they don’t need adding.</>}>
            <textarea name="synonyms" rows={14} defaultValue={settings.synonyms.map((g) => g.join(", ")).join("\n")} className="field font-mono text-xs" />
          </Field>
          <SubmitButton>Save</SubmitButton>
        </form>
      </Card>

      <Card title="Test a search">
        <form className="mb-4 flex gap-2" action="/admin/search/#test">
          <input name="test" defaultValue={test ?? ""} placeholder="e.g. borehole pump" className="field flex-1" />
          <SubmitButton>Test</SubmitButton>
        </form>
        <p className="mb-3 text-xs text-ink-soft">Shows the top 10 in the order shoppers see them, including drafts. Synonym changes apply as soon as they’re saved; product changes within a minute.</p>
        {testResult && (testResult.count === 0 ? <Empty>Nothing found for “{test}”.</Empty> : (<>
          <div className="mb-2 text-sm">
            {testResult.count} product{testResult.count === 1 ? "" : "s"} found
            {testResult.partial && <Badge className="ml-2 bg-amber-100 text-amber-800">no exact match: closest products</Badge>}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {testResult.names.map((p) => (
              <li key={p.id}><Link href={`/admin/products/${p.id}/`} className="hover:text-primary">{p.name}</Link>{p.status !== "published" && <span className="ml-2 text-xs text-ink-muted">({p.status})</span>}</li>
            ))}
          </ol>
        </>))}
      </Card>
    </div>
  </>);
}
