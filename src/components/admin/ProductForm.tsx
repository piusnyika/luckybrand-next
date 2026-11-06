"use client";
import { useMemo, useState } from "react";
import { RichText } from "./RichText";
import { MediaModal } from "./MediaPicker";
import { SubmitButton, ConfirmButton } from "./ui-client";
import { Icon } from "../Icon";
import { BundleEditor, type BundleRow } from "./BundleEditor";
import { SeoPanel } from "./SeoPanel";
import { hasTables, moveTablesToSpec } from "@/lib/spec-tables";

type Opt = { id: number; name: string; parentId?: number | null };
type P = Record<string, any> | null;

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-base border border-line bg-white"><h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">{title}</h2><div className="space-y-4 p-5">{children}</div></section>
);
const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}</label>;

export function ProductForm({ action, deleteAction, product: p, images: initImages, categories, brands, tags, selectedCats, selectedBrands, selectedTags, bundleItems = [], titleSuffix = "" }: {
  action: (fd: FormData) => void; deleteAction: (fd: FormData) => void; product: P; images: { id: number; url: string; alt?: string }[]; bundleItems?: BundleRow[]; titleSuffix?: string;
  categories: Opt[]; brands: Opt[]; tags: Opt[]; selectedCats: number[]; selectedBrands: number[]; selectedTags: number[];
}) {
  const [images, setImages] = useState(initImages);
  const [picker, setPicker] = useState(false);
  const [manage, setManage] = useState<boolean>(!!p?.manageStock);
  const [type, setType] = useState<"simple" | "bundle">(p?.type === "bundle" ? "bundle" : "simple");
  const [regular, setRegular] = useState<string>(p?.regularPrice ?? ""); const [sale, setSale] = useState<string>(p?.salePrice ?? "");
  const [cats, setCats] = useState<number[]>(selectedCats);
  const [attrs, setAttrs] = useState<{ name: string; values: string }[]>((p?.attributes ?? []).map((a: { name: string; values: string[] }) => ({ name: a.name, values: a.values.join(" | ") })));
  const [catFilter, setCatFilter] = useState("");
  const [seoTitle, setSeoTitle] = useState(p?.seoTitle ?? ""); const [seoDesc, setSeoDesc] = useState(p?.seoDescription ?? ""); const [name, setName] = useState(p?.name ?? "");
  // live SEO score: the editors report their HTML; an AI rewrite remounts them with the new text (copyKey)
  const [keyword, setKeyword] = useState<string>(p?.focusKeyword ?? "");
  const [shortHtml, setShortHtml] = useState<string>(p?.shortDescription ?? ""); const [descHtml, setDescHtml] = useState<string>(p?.description ?? ""); const [specHtml, setSpecHtml] = useState<string>(p?.specification ?? "");
  const [copyKey, setCopyKey] = useState(0);
  const [moveNote, setMoveNote] = useState("");
  const moveTables = () => {
    const r = moveTablesToSpec(descHtml, specHtml);
    setDescHtml(r.description); setSpecHtml(r.specification); setCopyKey((k) => k + 1);
    setMoveNote([r.moved && `Moved ${r.moved} table${r.moved === 1 ? "" : "s"} to Specifications.`, r.duplicates && `Removed ${r.duplicates} already in Specifications.`].filter(Boolean).join(" ") || "Nothing to move: the only table was a single box, now plain text.");
  };
  const [slug, setSlug] = useState<string>(p?.slug ?? "");
  const attrList = attrs.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), values: a.values.split("|").map((v) => v.trim()).filter(Boolean) }));
  const tree = useMemo(() => {
    const out: (Opt & { depth: number })[] = [];
    const walk = (parent: number | null, depth: number) => categories.filter((c) => (c.parentId ?? null) === parent).sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
    walk(null, 0); return out;
  }, [categories]);
  const move = (i: number, d: number) => setImages((im) => { const a = [...im]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(images.map((i) => i.id))} />
      <input type="hidden" name="attributes" value={JSON.stringify(attrs.map((a) => ({ name: a.name.trim(), values: a.values.split("|").map((v) => v.trim()).filter(Boolean) })))} />
      <input type="hidden" name="type" value={type} />
      <div className="space-y-6">
        <Card title="Product type">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["simple", "Single product", "Sold on its own, with its own stock."], ["bundle", "Bundle", "Made of other products (by SKU). Stock comes from them."]] as const).map(([v, l, d]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-form border p-3 text-sm ${type === v ? "border-primary bg-primary-50/50" : "border-line"}`}>
                <input type="radio" checked={type === v} onChange={() => setType(v)} className="mt-0.5 accent-primary" /><span><strong>{l}</strong><span className="block text-xs text-ink-soft">{d}</span></span>
              </label>
            ))}
          </div>
          {type === "bundle" && <BundleEditor initial={bundleItems} />}
        </Card>
        <Card title="General">
          <F label="Product name *"><input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="field" /></F>
          <F label="URL slug" hint="Leave blank to generate from the name. Changing it changes the product URL."><div className="flex items-center"><span className="flex h-[46px] items-center rounded-l-form border border-r-0 border-line bg-surface px-3 text-sm text-ink-muted">/product/</span><input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="field rounded-l-none" /></div></F>
          <F label="Short description"><RichText key={"s" + copyKey} name="shortDescription" defaultValue={shortHtml} onChange={setShortHtml} minHeight={100} /></F>
          <F label="Description"><RichText key={"d" + copyKey} name="description" defaultValue={descHtml} onChange={setDescHtml} minHeight={260} /></F>
          {hasTables(descHtml) && (
            <div className="-mt-2 flex flex-wrap items-center gap-3 rounded-form border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
              <span className="flex-1">This description contains a table. Specification tables read better in their own <strong>Specifications</strong> tab.</span>
              <button type="button" onClick={moveTables} className="btn-outline h-9 bg-white text-sm">Move tables to Specifications</button>
            </div>
          )}
          {moveNote && <p className="-mt-2 text-sm text-success">{moveNote} Check below, then save the product.</p>}
          <F label="Specification table (optional)" hint="Shown in its own “Specifications” tab next to Description, together with the attributes below. Paste a table or use the Table button."><RichText key={"sp" + copyKey} name="specification" defaultValue={specHtml} onChange={setSpecHtml} minHeight={120} /></F>
        </Card>
        <Card title="Images">
          <div className="flex flex-wrap gap-3">
            {images.map((im, i) => (
              <div key={im.id} className={`group relative h-28 w-28 overflow-hidden rounded-form border ${i === 0 ? "border-primary ring-2 ring-primary/20" : "border-line"} bg-surface`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="h-full w-full object-contain" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10px] font-semibold text-white">Main</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                  <button type="button" onClick={() => move(i, -1)} className="text-white" aria-label="Move left"><Icon name="chevronLeft" size={16} /></button>
                  <button type="button" onClick={() => setImages(images.filter((x) => x.id !== im.id))} className="text-white" aria-label="Remove"><Icon name="trash" size={16} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="text-white" aria-label="Move right"><Icon name="chevronRight" size={16} /></button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setPicker(true)} className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-form border border-dashed border-line text-xs text-ink-soft hover:border-primary hover:text-primary"><Icon name="plus" />Add images</button>
          </div>
          <p className="text-xs text-ink-muted">The first image is the main product image. Hover to reorder or remove.</p>
          <MediaModal open={picker} multiple onClose={() => setPicker(false)} onPick={(m) => setImages((cur) => [...cur, ...m.filter((x) => !cur.some((c) => c.id === x.id)).map((x) => ({ id: x.id, url: x.url }))])} />
        </Card>
        <Card title="Pricing & inventory">
          <div className="grid gap-4 sm:grid-cols-2">
            {type === "simple" && <>
            <F label="Regular price ($) *"><input name="regularPrice" type="number" step="0.01" min="0" required value={regular} onChange={(e) => setRegular(e.target.value)} className="field" /></F>
            <F label="Sale price ($)" hint="Leave blank for no sale."><input name="salePrice" type="number" step="0.01" min="0" value={sale} onChange={(e) => setSale(e.target.value)} className="field" /></F>
            <F label="Sale starts"><input name="saleFrom" type="date" defaultValue={p?.saleFrom} className="field" /></F>
            <F label="Sale ends"><input name="saleTo" type="date" defaultValue={p?.saleTo} className="field" /></F>
            </>}
            <F label="SKU"><input name="sku" defaultValue={p?.sku ?? ""} className="field" /></F>
            <F label="Weight (kg)"><input name="weight" defaultValue={p?.weight} className="field" /></F>
          </div>
          {type === "bundle" ? <p className="rounded-form bg-surface p-3 text-sm text-ink-soft">Stock for a bundle comes from the products in it (see Product type above), so there&apos;s nothing to set here.</p> : <>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="manageStock" checked={manage} onChange={(e) => setManage(e.target.checked)} className="accent-primary" /> Track stock quantity</label>
          <div className="grid gap-4 sm:grid-cols-3">
            {manage ? <>
              <F label="Quantity in stock"><input name="stockQty" type="number" defaultValue={p?.stockQty ?? 0} className="field" /></F>
              <F label="Low stock alert at"><input name="lowStockAmount" type="number" defaultValue={p?.lowStockAmount ?? ""} className="field" /></F>
            </> : null}
            <F label="Stock status"><select name="stockStatus" defaultValue={p?.stockStatus ?? "instock"} className="field"><option value="instock">In stock</option><option value="outofstock">Out of stock</option><option value="onbackorder">On backorder</option></select></F>
          </div>
          </>}
        </Card>
        <Card title="Attributes (shown in a table on the product page)">
          {attrs.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Name e.g. Capacity" value={a.name} onChange={(e) => setAttrs(attrs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="field w-1/3" />
              <input placeholder="Values separated by |" value={a.values} onChange={(e) => setAttrs(attrs.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} className="field flex-1" />
              <button type="button" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))} className="px-2 text-ink-muted hover:text-danger" aria-label="Remove"><Icon name="trash" size={18} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setAttrs([...attrs, { name: "", values: "" }])} className="text-sm font-semibold text-primary">+ Add attribute</button>
        </Card>
        <div id="seo" className="scroll-mt-20" />
        <Card title="Search engine (SEO)">
          <F label="SEO title" hint={`${(seoTitle || name).length} characters — aim for under 60.`}><input name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={name} className="field" /></F>
          <F label="Meta description" hint={`${seoDesc.length} characters — aim for 120–160.`}><textarea name="seoDescription" rows={3} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} className="field" /></F>
          <F label="Focus keyword" hint="The phrase customers would search for to find this product."><input name="focusKeyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="field" /></F>
          <div className="rounded-form bg-surface p-4 text-sm">
            <div className="truncate text-[#1a0dab]">{(seoTitle || name || "Product title") + titleSuffix}</div>
            <div className="text-xs text-green-700">/product/{slug || p?.slug || "…"}/</div>
            <div className="line-clamp-2 text-xs text-ink-soft">{seoDesc || "Meta description will appear here."}</div>
          </div>
          <SeoPanel productId={p?.id} attributes={attrList}
            input={{ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), seoTitle, seoDescription: seoDesc, focusKeyword: keyword,
              shortDescription: shortHtml, description: descHtml, specification: specHtml, attributeCount: attrList.length,
              imageCount: images.length, imagesWithoutAlt: images.filter((i) => i.alt !== undefined && !i.alt.trim()).length, categoryCount: cats.length, titleSuffix }}
            onSuggest={(s) => {
              setKeyword(s.focusKeyword); setSeoTitle(s.seoTitle); setSeoDesc(s.metaDescription);
              if (s.description) { setDescHtml(s.description); setShortHtml(s.shortDescription ?? shortHtml); setCopyKey((k) => k + 1); }
            }} />
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Publish">
          <F label="Status"><select name="status" defaultValue={(p?.status === "trash" ? p.statusBeforeTrash : p?.status) ?? "published"} className="field"><option value="published">Published</option><option value="draft">Draft (hidden)</option></select></F>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={!!p?.featured} className="accent-primary" /> Featured product (shows in “Featured Products”)</label>
          <F label="Badge text (optional)" hint="e.g. New, Hot, -20%"><input name="badgeText" defaultValue={p?.badgeText} className="field" /></F>
          <F label="Video URL (YouTube)"><input name="videoUrl" defaultValue={p?.videoUrl} className="field" /></F>
          <div className="flex items-center justify-between pt-2">
            {p && p.status !== "trash" ? <ConfirmButton formAction={deleteAction} message="Move this product to the trash? You can restore it later.">Move to trash</ConfirmButton> : <span />}
            <SubmitButton>{p ? "Update" : "Publish"}</SubmitButton>
          </div>
        </Card>
        <Card title="Categories">
          <input value={catFilter} onChange={(e) => setCatFilter(e.target.value)} placeholder="Filter categories…" className="field h-9 text-sm" />
          <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-form border border-line p-2">
            {tree.filter((c) => !catFilter || c.name.toLowerCase().includes(catFilter.toLowerCase())).map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm" style={{ paddingLeft: catFilter ? 0 : c.depth * 16 }}>
                <input type="checkbox" name="categories" value={c.id} checked={cats.includes(c.id)} onChange={(e) => setCats(e.target.checked ? [...cats, c.id] : cats.filter((x) => x !== c.id))} className="accent-primary" />{c.name}
              </label>
            ))}
          </div>
          {cats.length > 1 && <F label="Primary category (breadcrumbs)"><select name="primaryCategoryId" defaultValue={p?.primaryCategoryId ?? cats[0]} className="field">{cats.map((id) => <option key={id} value={id}>{categories.find((c) => c.id === id)?.name}</option>)}</select></F>}
          {cats.length === 1 && <input type="hidden" name="primaryCategoryId" value={cats[0]} />}
        </Card>
        <Card title="Brand">
          <div className="max-h-48 space-y-1 overflow-y-auto">{brands.map((b) => <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="brands" value={b.id} defaultChecked={selectedBrands.includes(b.id)} className="accent-primary" />{b.name}</label>)}</div>
        </Card>
        <Card title="Tags">
          <div className="max-h-48 space-y-1 overflow-y-auto">{tags.map((t) => <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="tags" value={t.id} defaultChecked={selectedTags.includes(t.id)} className="accent-primary" />{t.name}</label>)}</div>
          <F label="Add new tags" hint="Comma separated"><input name="newTags" className="field" /></F>
        </Card>
      </div>
    </form>
  );
}
