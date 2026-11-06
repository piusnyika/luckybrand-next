import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting, type SearchSettings } from "./settings";

/*
 * Product search for a catalogue of a few thousand products, done in memory:
 * - plurals ("generators"), spelling mistakes ("genarator", "solar pannel")
 * - sizes: "10kva" = "10 kva" = "10KVA", "4.0hp" = "4hp", "3ph" = "3 phase"; "10kva" never matches "100kva"; kW and kVA count as near-equal
 * - synonyms from Admin → Search ("borehole" finds "submersible")
 * - looks at name, SKU, brand, category, tags, attributes and short description, best match first
 * If no product matches every word, the products matching most of them are returned with `partial: true`.
 */

/* ---------------- text normalising ---------------- */

const UNIT: Record<string, string> = {
  kva: "kva", kw: "kw", kwh: "kwh", w: "w", watt: "w", watts: "w", hp: "hp", v: "v", vdc: "vdc", vac: "v", volt: "v", volts: "v",
  ah: "ah", a: "a", amp: "a", amps: "a", l: "l", lt: "l", ltr: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  mm: "mm", cm: "cm", m: "m", cc: "cc", cfm: "cfm", btu: "btu", t: "t", ton: "t", tons: "t", tonne: "t", kg: "kg",
  inch: "inch", inches: "inch", bar: "bar", ph: "phase", phase: "phase", pase: "phase", rpm: "rpm", kn: "kn",
};
/** Units that are close enough to count as a (weaker) match for each other */
const UNIT_FAMILY: Record<string, string> = { kva: "power", kw: "power" };

const num = (s: string) => String(parseFloat(s)); // "4.0" → "4", "0.75" → "0.75"

/** Lowercase, plain words; a number followed by a unit becomes one token ("10 kva" → "10kva"); ranges share the unit ("2.0 – 2.5kva" → "2kva 2.5kva") */
export function tokenize(text: string): string[] {
  let s = (text || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
  s = s.replace(/(\d)\s*["”]/g, "$1 inch ");
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*([a-z]+)/g, (m, a, b, u) => UNIT[u] ? `${a}${u} ${b}${u}` : m);
  const raw = s.replace(/[^a-z0-9.]+/g, " ").replace(/(?<!\d)\.|\.(?!\d)/g, " ").split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    let m = t.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (m && UNIT[m[2]]) { out.push(num(m[1]) + UNIT[m[2]]); continue; }
    if (/^\d+(?:\.\d+)?$/.test(t) && raw[i + 1] && UNIT[raw[i + 1]] && !/^\d/.test(raw[i + 1])) { out.push(num(t) + UNIT[raw[i + 1]]); i++; continue; }
    m = t.match(/^(\d+(?:\.\d+)?)$/);
    out.push(m ? num(m[1]) : t);
  }
  return out;
}

/** Very small English stemmer: plurals only, enough for product names */
export function stem(w: string): string {
  if (/\d/.test(w) || w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (/(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
  return w;
}

const words = (text: string) => tokenize(text).map(stem);

/** Edit distance (with swapped letters counting as one), giving up once it is over `max` */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
const typoAllowance = (w: string) => (/\d/.test(w) ? 0 : w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0);

/* ---------------- the in-memory index ---------------- */

type Field = { tokens: string[]; set: Set<string>; weight: number };
type Doc = { id: number; name: string; nameNorm: string; firstToken: string; sku: string; fields: Field[]; inStock: boolean; popularity: number };
type Index = { docs: Doc[]; vocab: Set<string>; vocabList: string[]; synonyms: string[][][]; at: number };

const TTL = 60_000;
let index: Index | null = null;
let building: Promise<Index> | null = null;

/** Drop the cached index (call after products, categories, brands or synonyms change; otherwise it refreshes within a minute) */
export function invalidateSearchIndex() { index = null; }

const field = (text: string, weight: number, compounds = false): Field => {
  const tokens = words(text);
  const set = new Set(tokens);
  // "jack hammer" is also findable as "jackhammer"
  if (compounds) for (let i = 0; i + 1 < tokens.length; i++) if (!/\d/.test(tokens[i] + tokens[i + 1])) set.add(stem(tokens[i] + tokens[i + 1]));
  return { tokens, set, weight };
};
const skuKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function buildIndex(): Promise<Index> {
  const [products, cats, brands, tags, settings] = await Promise.all([
    prisma.product.findMany({
      where: { status: { not: "trash" } },
      select: { id: true, name: true, sku: true, shortDescription: true, attributes: true, stockStatus: true, totalSales: true, views: true },
    }),
    prisma.productCategory.findMany({ select: { productId: true, category: { select: { name: true } } } }),
    prisma.productBrand.findMany({ select: { productId: true, brand: { select: { name: true } } } }),
    prisma.productTag.findMany({ select: { productId: true, tag: { select: { name: true } } } }),
    getSetting<SearchSettings>("search"),
  ]);
  const group = <T extends { productId: number }>(rows: T[], name: (r: T) => string) => {
    const m = new Map<number, string[]>();
    for (const r of rows) (m.get(r.productId) ?? m.set(r.productId, []).get(r.productId)!).push(name(r));
    return m;
  };
  const catBy = group(cats, (r) => r.category.name), brandBy = group(brands, (r) => r.brand.name), tagBy = group(tags, (r) => r.tag.name);

  const vocab = new Set<string>();
  const docs: Doc[] = products.map((p) => {
    const attrs = Array.isArray(p.attributes) ? (p.attributes as { name?: string; values?: string[] }[]).map((a) => `${a.name ?? ""} ${(a.values ?? []).join(" ")}`).join(" ") : "";
    const fields = [
      field(p.name, 3, true),
      field(p.sku ?? "", 3),
      field((brandBy.get(p.id) ?? []).join(" "), 2),
      field((catBy.get(p.id) ?? []).join(" "), 2, true),
      field((tagBy.get(p.id) ?? []).join(" "), 1.5),
      field(attrs, 1),
      field((p.shortDescription ?? "").slice(0, 2000), 0.6),
    ];
    for (const f of fields) for (const t of f.set) vocab.add(t);
    const nameTokens = fields[0].tokens;
    return {
      id: p.id, name: p.name, nameNorm: " " + nameTokens.join(" ") + " ", firstToken: nameTokens[0] ?? "", sku: skuKey(p.sku ?? ""),
      fields, inStock: p.stockStatus !== "outofstock", popularity: Math.log1p(p.totalSales * 5 + p.views / 20),
    };
  });
  const synonyms = (settings.synonyms ?? []).map((g) => g.map((alt) => words(alt)).filter((a) => a.length)).filter((g) => g.length > 1);
  return { docs, vocab, vocabList: [...vocab], synonyms, at: Date.now() };
}

async function getIndex(): Promise<Index> {
  if (index && Date.now() - index.at < TTL) return index;
  building ??= buildIndex().then((i) => { index = i; return i; }).finally(() => { building = null; });
  // serve the slightly old index while a fresh one builds
  return index ?? building;
}

/* ---------------- matching ---------------- */

/** One word of the query, with everything it may match: alternative phrases (synonyms) and close spellings */
type Term = { word: string; alts: { phrase: string[]; quality: number }[]; prefix: boolean };

function buildTerms(q: string, idx: Index): Term[] {
  const toks = words(q).slice(0, 8);
  const terms: Term[] = [];
  for (let i = 0; i < toks.length; i++) {
    // a multi-word synonym typed in full ("water heater") counts as one term
    let used = 1; let group: string[][] | undefined;
    for (const g of idx.synonyms) {
      for (const alt of g) {
        if (alt.length > used && alt.every((w, k) => toks[i + k] === w)) { used = alt.length; group = g; }
      }
    }
    const word = toks.slice(i, i + used).join(" ");
    const alts: Term["alts"] = [{ phrase: toks.slice(i, i + used), quality: 1 }];
    if (used === 1) group = idx.synonyms.find((g) => g.some((a) => a.length === 1 && a[0] === toks[i]));
    for (const a of group ?? []) if (a.join(" ") !== word) alts.push({ phrase: a, quality: 0.9 });
    // spelling mistakes: only for words that aren't in the catalogue at all
    if (used === 1 && !idx.vocab.has(toks[i]) && !(group?.length)) {
      const max = typoAllowance(toks[i]);
      const isPrefix = idx.vocabList.some((v) => v.startsWith(toks[i]));
      if (max && !isPrefix) {
        const close = idx.vocabList.map((v) => [v, distance(toks[i], v, max)] as const).filter(([, d]) => d <= max).sort((a, b) => a[1] - b[1]).slice(0, 4);
        for (const [v, d] of close) alts.push({ phrase: [v], quality: d === 1 ? 0.7 : 0.55 });
      }
    }
    terms.push({ word, alts, prefix: used === 1 && !/\d/.test(toks[i]) && (toks[i].length >= 3 || i + used === toks.length) });
    i += used - 1;
  }
  return terms;
}

/** How well a single query token matches a single product token (0 = not at all) */
function tokenQuality(qt: string, dt: string): number {
  if (qt === dt) return 1;
  const qm = qt.match(/^(\d+(?:\.\d+)?)([a-z]*)$/), dm = dt.match(/^(\d+(?:\.\d+)?)([a-z]*)$/);
  if (qm && dm && qm[1] === dm[1]) {
    if (!qm[2]) return 0.9;                                                  // "10" matches "10kva"
    if (UNIT_FAMILY[qm[2]] && UNIT_FAMILY[qm[2]] === UNIT_FAMILY[dm[2]]) return 0.8; // 5kw ≈ 5kva
  }
  return 0;
}

/** Same unit, size within 35%: only used when nothing matches exactly ("10kva" → 8.5kva / 12kva) */
function nearSize(qt: string, dt: string): number {
  const qm = qt.match(/^(\d+(?:\.\d+)?)([a-z]+)$/), dm = dt.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
  if (!qm || !dm) return 0;
  const sameUnit = qm[2] === dm[2] || (UNIT_FAMILY[qm[2]] && UNIT_FAMILY[qm[2]] === UNIT_FAMILY[dm[2]]);
  if (!sameUnit) return 0;
  const a = Number(qm[1]), b = Number(dm[1]);
  const r = Math.min(a, b) / Math.max(a, b);
  return r >= 0.65 ? 0.25 + 0.2 * r : 0;
}

function phraseIn(f: Field, phrase: string[]): boolean {
  if (phrase.length === 1) return f.set.has(phrase[0]);
  outer: for (let i = 0; i + phrase.length <= f.tokens.length; i++) {
    for (let k = 0; k < phrase.length; k++) if (f.tokens[i + k] !== phrase[k]) continue outer;
    return true;
  }
  return false;
}

/** Best score of one term in one product: [strict score, score allowing near sizes] */
function termScore(t: Term, d: Doc): [number, number] {
  let best = 0, near = 0;
  for (const f of d.fields) {
    for (const a of t.alts) {
      if (phraseIn(f, a.phrase)) { best = Math.max(best, f.weight * a.quality); continue; }
      if (a.phrase.length !== 1) continue;
      const w = a.phrase[0];
      for (const dt of f.set) {
        const q = tokenQuality(w, dt);
        if (q) best = Math.max(best, f.weight * q * a.quality);
        else if (t.prefix && a.quality === 1 && dt.length > w.length && dt.startsWith(w)) best = Math.max(best, f.weight * 0.75);
        else { const n = nearSize(w, dt); if (n) near = Math.max(near, f.weight * n); }
      }
    }
  }
  return [best, Math.max(best, near)];
}

/** +1.5 for each pair of neighbouring search words that also sit side by side in the name ("solar panel" beats "solar … 30w panel") */
function adjacency(terms: Term[], name: Field): number {
  let bonus = 0;
  for (let i = 0; i + 1 < terms.length; i++) {
    const a = new Set(terms[i].alts.map((x) => x.phrase[x.phrase.length - 1])), b = new Set(terms[i + 1].alts.map((x) => x.phrase[0]));
    for (let k = 0; k + 1 < name.tokens.length; k++) if (a.has(name.tokens[k]) && b.has(name.tokens[k + 1])) { bonus += 1.5; break; }
  }
  return bonus;
}

export type SearchResult = { ids: number[]; partial: boolean };

/** Ranked product ids for a search (published or not: callers filter status). Empty query → no results. */
export async function searchProducts(q: string): Promise<SearchResult> {
  const query = q.trim().slice(0, 120);
  if (!query) return { ids: [], partial: false };
  const idx = await getIndex();
  const terms = buildTerms(query, idx);
  if (!terms.length) return { ids: [], partial: false };
  const qNorm = " " + words(query).join(" ") + " ";
  const qSku = skuKey(query);

  // sorted by: how strong the match is (name/SKU, then brand/category, then description), then in stock first, then score
  const strict: { id: number; tier: number; inStock: boolean; score: number }[] = [];
  const loose: { id: number; score: number; hits: number }[] = [];
  for (const d of idx.docs) {
    let sum = 0, nearSum = 0, all = true, hits = 0;
    for (const t of terms) {
      const [s, n] = termScore(t, d);
      if (!s) all = false;
      if (n) hits++;
      sum += s; nearSum += n;
    }
    const bonus = (qNorm.trim() && d.nameNorm.includes(qNorm) ? 3 : 0) + (terms[0] && d.firstToken === terms[0].alts[0].phrase[0] ? 0.5 : 0)
      + adjacency(terms, d.fields[0]) + (d.inStock ? 0.5 : 0) + Math.min(d.popularity, 6) * 0.15;
    if (qSku.length >= 3 && d.sku === qSku) { strict.push({ id: d.id, tier: 9, inStock: true, score: 1000 }); continue; }
    if (all) { const avg = sum / terms.length; strict.push({ id: d.id, tier: avg >= 2.4 ? 2 : avg >= 1.4 ? 1 : 0, inStock: d.inStock, score: sum + bonus }); }
    else if (terms.length > 1 && hits >= Math.ceil(terms.length / 2)) loose.push({ id: d.id, score: nearSum + bonus, hits });
  }
  if (strict.length) return { ids: strict.sort((a, b) => b.tier - a.tier || Number(b.inStock) - Number(a.inStock) || b.score - a.score).map((x) => x.id), partial: false };
  // closest: only products matching as many words as the best ones do (so "10kva generator" → generators of a similar size, not every generator)
  const most = Math.max(0, ...loose.map((x) => x.hits));
  const closest = loose.filter((x) => x.hits === most).sort((a, b) => b.score - a.score);
  return { ids: closest.slice(0, 200).map((x) => x.id), partial: closest.length > 0 };
}

/** Does this short label (a category or brand name) match every word of the search? */
export async function labelMatcher(q: string) {
  const idx = await getIndex();
  const terms = buildTerms(q.trim().slice(0, 120), idx);
  return (label: string) => {
    if (!terms.length) return false;
    const f = field(label, 1, true);
    const d = { fields: [f] } as Doc;
    return terms.every((t) => termScore(t, d)[0] > 0);
  };
}

/* ---------------- search log (Admin → Search) ---------------- */

/** Count a search shoppers made. Never throws: logging must not break search. */
export async function logSearch(q: string, results: number) {
  const term = q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100);
  if (term.length < 2) return;
  try {
    await prisma.$executeRaw`INSERT INTO search_terms (term, searches, last_results, first_at, last_at) VALUES (${term}, 1, ${results}, NOW(), NOW())
      ON CONFLICT (term) DO UPDATE SET last_results = ${results}, last_at = NOW(),
        -- the dropdown and the results page both report a search: repeats within 30 seconds count once
        searches = search_terms.searches + CASE WHEN search_terms.last_at > NOW() - INTERVAL '30 seconds' THEN 0 ELSE 1 END`;
  } catch (e) { console.error("logSearch:", e); }
}
