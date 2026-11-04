import Link from "next/link";
import { requireStaff } from "@/lib/admin/guard";
import { seoScores } from "@/lib/seo-data";
import { gradeColor } from "@/lib/seo-score";
import { seoAiAvailable } from "@/lib/seo-ai";
import { ASSISTANT_MODELS, getSetting, type SeoSettings } from "@/lib/settings";
import { PageHeader, Card, Field, Badge, Table, th, td, SubmitButton, FlashToast } from "@/components/admin/ui";
import { SeoBulkWriter } from "@/components/admin/SeoBulkWriter";
import { saveSeoSettings } from "./actions";

export const metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

/** Problems worth fixing across the catalogue: check id → label */
const ISSUES: [string, string][] = [
  ["keyword", "No focus keyword"], ["desc", "Meta description missing or wrong length"], ["title-length", "Title too long or too short"],
  ["content", "Description under 250 words"], ["images", "Fewer than 2 images"], ["short", "No short description"], ["kw-title", "Keyword not in the title"],
];

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const [rows, seo] = await Promise.all([seoScores({ status: "published" }), getSetting<SeoSettings>("seo")]);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.result.score, 0) / rows.length) : 0;
  const count = (g: string) => rows.filter((r) => r.result.grade === g).length;
  const failing = (id: string) => rows.filter((r) => r.result.checks.some((c) => c.id === id && c.status !== "good"));
  // the same title on several products: Google can't tell which to show
  const titles = new Map<string, string[]>();
  for (const r of rows) { const t = (r.input.seoTitle || r.name).trim().toLowerCase(); titles.set(t, [...(titles.get(t) ?? []), r.name]); }
  const dupes = [...titles.entries()].filter(([, v]) => v.length > 1);
  const issue = ISSUES.find(([k]) => k === sp.issue);
  const list = (issue ? failing(issue[0]) : rows).sort((a, b) => a.result.score - b.result.score).slice(0, 100);
  const missing = rows.filter((r) => !r.input.seoTitle || !r.input.seoDescription || !r.input.focusKeyword).map((r) => r.id);
  return (<>
    <FlashToast />
    <PageHeader title="SEO" subtitle="How well each product page is set up to be found on Google, and what to fix. Scores update as you edit products." />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><p className="text-sm text-ink-soft">Average score</p><p className="mt-1 text-3xl font-bold">{avg}<span className="text-base font-medium text-ink-muted">/100</span></p></Card>
      <Card><p className="text-sm text-ink-soft">Good (80+)</p><p className="mt-1 text-3xl font-bold text-success">{count("good")}</p></Card>
      <Card><p className="text-sm text-ink-soft">Needs work (50–79)</p><p className="mt-1 text-3xl font-bold text-amber-600">{count("ok")}</p></Card>
      <Card><p className="text-sm text-ink-soft">Poor (under 50)</p><p className="mt-1 text-3xl font-bold text-danger">{count("poor")}</p></Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card title="Write SEO with AI">
          <p className="mb-4 text-sm text-ink-soft">Claude writes a focus keyword, an SEO title and a meta description for each product from what the product page already says. You can check and change any of it in the product editor afterwards.</p>
          <SeoBulkWriter model={seo.aiModel} available={seoAiAvailable()} groups={[
            { key: "missing", label: "Missing SEO fields", ids: missing },
            { key: "poor", label: "Poor score", ids: rows.filter((r) => r.result.grade === "poor").map((r) => r.id) },
            { key: "all", label: "All published", ids: rows.map((r) => r.id) },
          ]} />
        </Card>

        <Card title={issue ? `Products: ${issue[1].toLowerCase()}` : "Lowest scores"} actions={issue && <Link href="/admin/seo/" className="text-sm text-primary">Show all</Link>}>
          <Table head={<><th className={th}>Product</th><th className={th}>Score</th><th className={th}>Top fix</th></>}>
            {list.map((r) => {
              const fix = r.result.checks.find((c) => c.status === "bad") ?? r.result.checks.find((c) => c.status === "ok");
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className={td}><Link href={`/admin/products/${r.id}/#seo`} className="font-medium hover:text-primary">{r.name}</Link></td>
                  <td className={td}><Badge className={gradeColor(r.result.grade)}>{r.result.score}</Badge></td>
                  <td className={`${td} text-sm text-ink-soft`}>{fix?.tip ?? "–"}</td>
                </tr>
              );
            })}
          </Table>
          {(issue ? failing(issue[0]).length : rows.length) > 100 && <p className="mt-2 text-xs text-ink-muted">Showing the 100 lowest.</p>}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Most common problems">
          <ul className="space-y-2 text-sm">
            {ISSUES.map(([k, l]) => { const n = failing(k).length; return (
              <li key={k} className="flex items-center justify-between gap-2"><Link href={`/admin/seo/?issue=${k}`} className={`hover:text-primary ${sp.issue === k ? "font-semibold text-primary" : ""}`}>{l}</Link><span className={n ? "font-semibold" : "text-success"}>{n || "✓"}</span></li>
            ); })}
            <li className="flex items-center justify-between gap-2"><span>Same title on several products</span><span className={dupes.length ? "font-semibold" : "text-success"}>{dupes.length || "✓"}</span></li>
          </ul>
          {dupes.length > 0 && <details className="mt-3 text-xs text-ink-soft"><summary className="cursor-pointer">Show duplicates</summary><ul className="mt-2 space-y-1">{dupes.slice(0, 30).map(([t, v]) => <li key={t}>“{t}”: {v.length} products</li>)}</ul></details>}
        </Card>

        <Card title="Already done for every page">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>Sitemap at <a href="/sitemap.xml" target="_blank" className="text-primary">/sitemap.xml</a> with product images, and robots.txt</li>
            <li>Product data for Google (price, stock, brand, star ratings) and breadcrumbs</li>
            <li>Store and search-box data on the homepage</li>
            <li>One canonical address per page, and redirects from the old site&apos;s URLs</li>
            <li>A meta description is written from the product text when none is set</li>
          </ul>
        </Card>

        {me.role === "admin" && <form action={saveSeoSettings}><Card title="Settings">
          <div className="space-y-4">
            <Field label="AI model for SEO writing"><select name="aiModel" defaultValue={seo.aiModel} className="field">{ASSISTANT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
            <Field label="Google Search Console verification" hint="Search Console → Add property → HTML tag: paste the tag or just its content code. Then submit /sitemap.xml there.">
              <input name="googleVerification" defaultValue={seo.googleVerification} className="field" placeholder="e.g. abc123…" /></Field>
            <Field label="Bing Webmaster verification" hint="Bing Webmaster Tools → HTML meta tag (msvalidate.01).">
              <input name="bingVerification" defaultValue={seo.bingVerification} className="field" /></Field>
            <div className="flex justify-end"><SubmitButton>Save</SubmitButton></div>
          </div>
        </Card></form>}
      </div>
    </div>
  </>);
}
