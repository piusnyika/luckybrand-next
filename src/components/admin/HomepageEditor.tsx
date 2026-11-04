"use client";
import { useState } from "react";
import { MediaModal } from "./MediaPicker";
import { SubmitButton } from "./ui-client";
import { Icon } from "../Icon";
import type { HomepageSettings, HomeSection } from "@/lib/settings";

type Cat = { id: number; name: string; parentId: number | null };
const SOURCES = [["latest", "Newest products"], ["featured", "Featured products"], ["on_sale", "On sale"], ["best_selling", "Best selling"], ["random", "Random"]] as const;

function ImagePick({ value, onChange, aspect = "aspect-[936/440]" }: { value: string; onChange: (v: string) => void; aspect?: string }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" onClick={() => setOpen(true)} className={`relative block w-full overflow-hidden rounded-form border border-dashed border-line bg-surface ${aspect}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-muted"><Icon name="image" /> Choose image</span>}
    </button>
    <MediaModal open={open} onClose={() => setOpen(false)} onPick={(m) => m[0] && onChange(m[0].url)} />
  </>);
}

export function HomepageEditor({ action, initial, categories }: { action: (fd: FormData) => void; initial: HomepageSettings; categories: Cat[] }) {
  const [slides, setSlides] = useState(initial.slides);
  const [sections, setSections] = useState<HomeSection[]>(initial.sections);
  const moveArr = <T,>(a: T[], i: number, d: number) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; };
  const setSec = (i: number, patch: Partial<HomeSection>) => setSections(sections.map((s, k) => (k === i ? ({ ...s, ...patch } as HomeSection) : s)));
  const label = (c: Cat) => (c.parentId ? `${categories.find((x) => x.id === c.parentId)?.name ?? ""} › ${c.name}` : c.name);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="data" value={JSON.stringify({ slides, sections })} />
      <section className="rounded-base border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="font-semibold">Hero slider <span className="text-xs font-normal text-ink-muted">(best size 936 × 440px)</span></h2>
          <button type="button" onClick={() => setSlides([...slides, { image: "", link: "", alt: "" }])} className="text-sm font-semibold text-primary">+ Add slide</button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {slides.map((sl, i) => (
            <div key={i} className="space-y-2 rounded-form border border-line p-3">
              <ImagePick value={sl.image} onChange={(v) => setSlides(slides.map((x, k) => (k === i ? { ...x, image: v } : x)))} />
              <input value={sl.link} onChange={(e) => setSlides(slides.map((x, k) => (k === i ? { ...x, link: e.target.value } : x)))} placeholder="Link e.g. /product-category/solar/" className="field h-9 text-xs" />
              <input value={sl.alt} onChange={(e) => setSlides(slides.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} placeholder="Alt text (describe the banner)" className="field h-9 text-xs" />
              <div className="flex justify-between text-xs">
                <span className="flex gap-2"><button type="button" onClick={() => setSlides(moveArr(slides, i, -1))}>← Move</button><button type="button" onClick={() => setSlides(moveArr(slides, i, 1))}>Move →</button></span>
                <button type="button" onClick={() => setSlides(slides.filter((_, k) => k !== i))} className="text-danger">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {sections.map((sec, i) => (
        <section key={i} className="rounded-base border border-line bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold uppercase text-ink-soft">{sec.type === "promo-banner" ? "Promo banner" : sec.type === "product-carousel" ? "Product carousel" : "Product grid"}</span>
            <span className="flex-1 font-semibold">{sec.title || "Untitled"}</span>
            <button type="button" onClick={() => setSections(moveArr(sections, i, -1))} className="text-sm text-ink-soft hover:text-ink">↑</button>
            <button type="button" onClick={() => setSections(moveArr(sections, i, 1))} className="text-sm text-ink-soft hover:text-ink">↓</button>
            <button type="button" onClick={() => setSections(sections.filter((_, k) => k !== i))} className="text-sm text-danger">Remove</button>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label><span className="label">Title</span><input value={sec.title} onChange={(e) => setSec(i, { title: e.target.value })} className="field" /></label>
            {sec.type === "promo-banner" ? <>
              <label><span className="label">Button label</span><input value={sec.buttonLabel} onChange={(e) => setSec(i, { buttonLabel: e.target.value } as Partial<HomeSection>)} className="field" /></label>
              <label className="md:col-span-2"><span className="label">Text (HTML allowed)</span><input value={sec.html} onChange={(e) => setSec(i, { html: e.target.value } as Partial<HomeSection>)} className="field" /></label>
              <label><span className="label">Link</span><input value={sec.link} onChange={(e) => setSec(i, { link: e.target.value })} className="field" /></label>
              <label><span className="label">Background colour</span><input type="color" value={sec.background} onChange={(e) => setSec(i, { background: e.target.value } as Partial<HomeSection>)} className="field h-[46px] p-1" /></label>
              <div className="md:col-span-2 md:w-1/2"><span className="label">Image (right side)</span><ImagePick value={sec.image} onChange={(v) => setSec(i, { image: v } as Partial<HomeSection>)} aspect="aspect-[800/250]" /></div>
            </> : <>
              <label><span className="label">Show</span><select value={sec.source} onChange={(e) => setSec(i, { source: e.target.value } as Partial<HomeSection>)} className="field">{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label><span className="label">Layout</span><select value={sec.type} onChange={(e) => setSec(i, { type: e.target.value } as Partial<HomeSection>)} className="field"><option value="product-grid">Grid (6 per row)</option><option value="product-carousel">Carousel (scrolls sideways)</option></select></label>
              <label><span className="label">Number of products</span><input type="number" min={1} max={48} value={sec.limit} onChange={(e) => setSec(i, { limit: Number(e.target.value) } as Partial<HomeSection>)} className="field" /></label>
              <label><span className="label">“View All” link</span><input value={sec.link} onChange={(e) => setSec(i, { link: e.target.value })} placeholder="/shop/" className="field" /></label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={sec.hideOutOfStock} onChange={(e) => setSec(i, { hideOutOfStock: e.target.checked } as Partial<HomeSection>)} className="accent-primary" /> Hide out-of-stock products</label>
              <div className="md:col-span-2"><span className="label">Only from these categories (optional)</span>
                <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto rounded-form border border-line p-3">
                  {categories.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={sec.categoryIds.includes(c.id)} onChange={(e) => setSec(i, { categoryIds: e.target.checked ? [...sec.categoryIds, c.id] : sec.categoryIds.filter((x) => x !== c.id) } as Partial<HomeSection>)} className="accent-primary" />{label(c)}</label>)}
                </div></div>
              <div className="md:col-span-2"><span className="label">Banner above products (optional, 1360 × 260px)</span>
                <div className="grid gap-3 md:grid-cols-2"><ImagePick value={sec.banner?.image ?? ""} onChange={(v) => setSec(i, { banner: { image: v, title: sec.banner?.title ?? "", subtitle: "", text: "", link: sec.banner?.link ?? "" } } as Partial<HomeSection>)} aspect="aspect-[1360/260]" />
                  <div className="space-y-2"><input value={sec.banner?.link ?? ""} onChange={(e) => setSec(i, { banner: { ...(sec.banner ?? { image: "", title: "", subtitle: "", text: "" }), link: e.target.value } } as Partial<HomeSection>)} placeholder="Banner link" className="field h-10 text-sm" />
                    {sec.banner?.image && <button type="button" onClick={() => setSec(i, { banner: null } as Partial<HomeSection>)} className="text-xs text-danger">Remove banner</button>}</div></div></div>
            </>}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-2 rounded-base border border-dashed border-line bg-white p-4">
        <span className="mr-2 text-sm font-medium">Add section:</span>
        <button type="button" onClick={() => setSections([...sections, { type: "product-grid", title: "New section", linkLabel: "View All", link: "/shop/", source: "latest", categoryIds: [], limit: 12, hideOutOfStock: true, banner: null }])} className="btn-outline h-9 text-sm">Product grid</button>
        <button type="button" onClick={() => setSections([...sections, { type: "product-carousel", title: "New carousel", linkLabel: "View All", link: "/shop/", source: "featured", categoryIds: [], limit: 12, hideOutOfStock: true, banner: null }])} className="btn-outline h-9 text-sm">Product carousel</button>
        <button type="button" onClick={() => setSections([...sections, { type: "promo-banner", title: "Promotion", html: "", buttonLabel: "Shop Now", link: "/shop/", image: "", background: "#ed1b24" }])} className="btn-outline h-9 text-sm">Promo banner</button>
        <div className="ml-auto"><SubmitButton>Save homepage</SubmitButton></div>
      </div>
    </form>
  );
}
