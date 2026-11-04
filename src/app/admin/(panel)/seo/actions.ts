"use server";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff, refreshStore } from "@/lib/admin/guard";
import { ASSISTANT_MODELS, saveSetting, type SeoSettings } from "@/lib/settings";
import { suggestSeo, type SeoFacts, type SeoSuggestion } from "@/lib/seo-ai";
import { effectivePrice } from "@/lib/catalog";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const plainWords = (html: string | null) => (html ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

async function factsFor(id: number): Promise<SeoFacts | null> {
  const p = await prisma.product.findUnique({ where: { id }, include: {
    brands: { select: { brand: { select: { name: true } } } }, categories: { select: { category: { select: { name: true } } } },
  } });
  if (!p) return null;
  return {
    name: p.name, sku: p.sku, brand: p.brands[0]?.brand.name, categories: p.categories.map((c) => c.category.name), price: effectivePrice(p).price,
    shortDescription: p.shortDescription ?? "", description: p.description ?? "", specification: p.specification ?? "", attributes: p.attributes ?? [],
  };
}

export type SuggestState = { ok?: SeoSuggestion; error?: string };

/** Product editor: suggestions from what's in the form right now (nothing is saved until the form is) */
export async function suggestForForm(form: { id?: number; name: string; shortDescription: string; description: string; specification: string; attributes: { name: string; values: string[] }[]; writeCopy: boolean }): Promise<SuggestState> {
  const u = await requireStaff();
  if (!(await rateLimit("seo-ai:" + u.id, 60, 60 * 60))) return { error: "That's a lot of suggestions for one hour. Try again later." };
  if (!form.name.trim()) return { error: "Give the product a name first." };
  const saved = form.id ? await factsFor(form.id) : null;
  try {
    return { ok: await suggestSeo({ ...(saved ?? { categories: [] }), name: form.name, shortDescription: form.shortDescription, description: form.description, specification: form.specification, attributes: form.attributes }, { writeCopy: form.writeCopy }) };
  } catch (e) { console.error("seo suggest:", e); return { error: (e as Error).message || "The AI suggestion failed. Try again." }; }
}

export type BatchResult = { id: number; name: string; ok: boolean; error?: string; filled: string[] };

/**
 * Admin → SEO bulk writer, a few products per call (the page calls it repeatedly and shows progress).
 * Fills only empty fields unless `overwrite`; with `writeCopy`, also writes descriptions for products with fewer than 100 words.
 */
export async function generateBatch(ids: number[], opts: { overwrite: boolean; writeCopy: boolean }): Promise<BatchResult[]> {
  await requireAdmin();
  const one = async (id: number): Promise<BatchResult> => {
    const p = await prisma.product.findUnique({ where: { id }, select: { name: true, seoTitle: true, seoDescription: true, focusKeyword: true, description: true, shortDescription: true } });
    if (!p) return { id, name: `#${id}`, ok: false, error: "not found", filled: [] };
    const thin = plainWords(p.description) < 100;
    const wantCopy = opts.writeCopy && (opts.overwrite || thin);
    try {
      const f = await factsFor(id);
      const s = await suggestSeo(f!, { writeCopy: wantCopy });
      const data: Record<string, string> = {}; const filled: string[] = [];
      const set = (field: "seoTitle" | "seoDescription" | "focusKeyword" | "description" | "shortDescription", value: string | undefined, label: string) => {
        if (value && (opts.overwrite || !(p[field] ?? "").replace(/<[^>]+>/g, "").trim() || (field === "description" && thin))) { data[field] = value; filled.push(label); }
      };
      set("focusKeyword", s.focusKeyword, "keyword"); set("seoTitle", s.seoTitle, "title"); set("seoDescription", s.metaDescription, "meta description");
      if (wantCopy) { set("description", s.description, "description"); set("shortDescription", s.shortDescription, "short description"); }
      if (filled.length) await prisma.product.update({ where: { id }, data });
      return { id, name: p.name, ok: true, filled };
    } catch (e) { return { id, name: p.name, ok: false, error: (e as Error).message, filled: [] }; }
  };
  const out: BatchResult[] = [];
  // three at a time: quick enough, gentle on the API rate limits
  for (let i = 0; i < ids.length; i += 3) out.push(...(await Promise.all(ids.slice(i, i + 3).map(one))));
  refreshStore();
  return out;
}

export async function saveSeoSettings(fd: FormData) {
  await requireAdmin();
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  // people paste the whole <meta> tag: keep just the code
  const code = (v: string) => (v.match(/content=["']([^"']+)["']/)?.[1] ?? v).replace(/[^\w-]/g, "");
  await saveSetting("seo", {
    aiModel: ASSISTANT_MODELS.some((m) => m.id === g("aiModel")) ? g("aiModel") : "claude-opus-5-5",
    googleVerification: code(g("googleVerification")), bingVerification: code(g("bingVerification")),
  } satisfies SeoSettings);
  refreshStore();
  redirect("/admin/seo/?msg=SEO%20settings%20saved");
}
