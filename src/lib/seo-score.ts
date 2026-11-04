// SEO score for a product page (0–100), with what to fix. Pure: used live in the product editor and on the
// server (products list, Admin → SEO), so both always agree. Weights favour what moves Google rankings most for
// a product page: a clear title and description that match what people search for, enough useful text, images.

export type SeoInput = {
  name: string; slug: string; seoTitle: string; seoDescription: string; focusKeyword: string;
  shortDescription: string; description: string; specification: string; attributeCount: number;
  imageCount: number; imagesWithoutAlt: number; categoryCount: number;
  /** added after every page title, e.g. " – A Lucky Brand" (counts towards the length Google shows) */
  titleSuffix?: string;
};
export type SeoStatus = "good" | "ok" | "bad";
export type SeoCheck = { id: string; label: string; status: SeoStatus; tip?: string };
export type SeoResult = { score: number; grade: "good" | "ok" | "poor"; checks: SeoCheck[] };

export const TITLE_MAX = 60, DESC_MIN = 120, DESC_MAX = 160;

const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (s: string) => (s ? s.split(" ").filter(Boolean) : []);
/** keyword appears (word for word, any case and punctuation) */
const has = (hay: string, kw: string) => !!kw && ` ${norm(hay)} `.includes(` ${norm(kw)} `);

/** What Google shows as the title: the SEO title, or the product name */
export const effectiveTitle = (i: Pick<SeoInput, "seoTitle" | "name">) => (i.seoTitle || i.name).trim();

export function analyzeProduct(i: SeoInput): SeoResult {
  const kw = i.focusKeyword.trim();
  const title = effectiveTitle(i);
  const body = text(i.description);
  const bodyWords = words(norm(body));
  const checks: (SeoCheck & { weight: number })[] = [];
  const add = (id: string, weight: number, status: SeoStatus, label: string, tip?: string) => checks.push({ id, weight, status, label, tip: status === "good" ? undefined : tip });

  // focus keyword: what a customer would type into Google to find this product
  add("keyword", 10, kw ? "good" : "bad", kw ? `Focus keyword: “${kw}”` : "No focus keyword", "Add the phrase customers would search for, e.g. “5kva inverter”.");
  if (kw) {
    add("kw-title", 10, has(title, kw) ? (norm(title).startsWith(norm(kw)) ? "good" : "ok") : "bad", has(title, kw) ? "Keyword in the title" : "Keyword missing from the title",
      has(title, kw) ? "Put the keyword near the start of the title." : "Use the focus keyword in the SEO title.");
    add("kw-desc", 8, has(i.seoDescription, kw) ? "good" : "bad", has(i.seoDescription, kw) ? "Keyword in the meta description" : "Keyword missing from the meta description", "Mention the keyword in the meta description.");
    add("kw-url", 5, has(i.slug.replace(/-/g, " "), kw) ? "good" : "ok", has(i.slug.replace(/-/g, " "), kw) ? "Keyword in the web address" : "Keyword not in the web address",
      "The URL slug doesn't contain the keyword. Only change it for new products (changing a live URL can lose its ranking).");
    const first = words(norm(body)).slice(0, 100).join(" ");
    add("kw-intro", 6, has(first, kw) ? "good" : "bad", has(first, kw) ? "Keyword in the first paragraph" : "Keyword not in the opening of the description", "Use the keyword in the first sentence or two of the description.");
    const n = norm(kw).split(" ").length;
    let hits = 0; const bw = bodyWords;
    for (let k = 0; k + n <= bw.length; k++) if (bw.slice(k, k + n).join(" ") === norm(kw)) hits++;
    const density = bw.length ? (hits * n * 100) / bw.length : 0;
    add("kw-density", 4, !bw.length ? "bad" : density > 4 ? "bad" : hits >= 2 ? "good" : "ok",
      density > 4 ? `Keyword used too often (${density.toFixed(1)}%)` : `Keyword used ${hits} time${hits === 1 ? "" : "s"} in the description`,
      density > 4 ? "Repeating the keyword looks like spam to Google. Use it naturally, 2–5 times." : "Use the keyword naturally 2–5 times in the description.");
  }

  // title and meta description: what people see in Google's results
  const suffix = i.titleSuffix ?? "";
  const tl = (title + suffix).length;
  add("title-length", 8, tl >= 30 && tl <= TITLE_MAX ? "good" : tl >= 15 && tl <= 70 ? "ok" : "bad", `Title length: ${tl} characters${suffix ? " with the store name" : ""}`,
    tl > TITLE_MAX ? `Google cuts titles after about ${TITLE_MAX} characters${suffix ? ` (the store name adds ${suffix.length})` : ""}. Shorten it to ${TITLE_MAX - suffix.length} or less.` : "Make the title more descriptive: product, key spec, brand.");
  const dl = i.seoDescription.trim().length;
  add("desc", 10, dl >= DESC_MIN && dl <= DESC_MAX ? "good" : dl >= 70 && dl <= 175 ? "ok" : "bad", dl ? `Meta description: ${dl} characters` : "No meta description",
    dl ? (dl > DESC_MAX ? `Shorten to ${DESC_MIN}–${DESC_MAX} characters so Google doesn't cut it off.` : `Lengthen to ${DESC_MIN}–${DESC_MAX} characters.`) : "Write a meta description: it's the text under the title in Google, and a good one gets more clicks.");

  // content: Google ranks pages that answer the customer's questions
  const bl = bodyWords.length;
  add("content", 12, bl >= 250 ? "good" : bl >= 100 ? "ok" : "bad", `Description: ${bl} words`,
    "Write at least 250 words: what it's for, key features, specifications, what's in the box, warranty and delivery.");
  add("short", 4, text(i.shortDescription).length >= 40 ? "good" : "bad", text(i.shortDescription) ? "Short description added" : "No short description", "Add 1–3 sentences summarising the product (shown next to the price).");
  add("structure", 3, /<(h2|h3|h4|ul|ol|table)\b/i.test(i.description) ? "good" : "ok", /<(h2|h3|h4|ul|ol|table)\b/i.test(i.description) ? "Description uses headings or lists" : "Description is one block of text",
    "Break it up with headings and bullet points: easier to read, and Google understands it better.");
  add("specs", 4, text(i.specification) || i.attributeCount ? "good" : "ok", text(i.specification) || i.attributeCount ? "Specifications listed" : "No specifications", "Add a specification table or attributes (power, size, capacity…).");

  // images and organisation
  add("images", 8, i.imageCount >= 2 ? "good" : i.imageCount === 1 ? "ok" : "bad", i.imageCount ? `${i.imageCount} image${i.imageCount === 1 ? "" : "s"}` : "No images",
    i.imageCount ? "Add more photos (different angles, in use): they show in Google Images too." : "Add product photos. Pages without images rarely rank or sell.");
  if (i.imageCount) add("alt", 3, i.imagesWithoutAlt === 0 ? "good" : "ok", i.imagesWithoutAlt ? `${i.imagesWithoutAlt} image${i.imagesWithoutAlt === 1 ? "" : "s"} without alt text` : "All images have alt text",
    "Describe each image in the Media library (alt text). Until then the product name is used.");
  add("category", 2, i.categoryCount ? "good" : "bad", i.categoryCount ? "In a category" : "Not in any category", "Put the product in a category so it's linked from the category pages.");

  const total = checks.reduce((a, c) => a + c.weight, 0);
  const got = checks.reduce((a, c) => a + c.weight * (c.status === "good" ? 1 : c.status === "ok" ? 0.5 : 0), 0);
  const score = Math.round((got / total) * 100);
  const order = { bad: 0, ok: 1, good: 2 };
  return {
    score, grade: score >= 80 ? "good" : score >= 50 ? "ok" : "poor",
    checks: checks.sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight).map(({ weight: _w, ...c }) => c),
  };
}

/** Meta description when none is set: the product's own words, cut at a sentence or word, plus a call to action */
export function autoDescription(name: string, html: string, siteName: string) {
  const t = text(html);
  const cta = ` Order online from ${siteName}.`;
  const room = DESC_MAX - cta.length;
  let d = t.length <= room ? t : t.slice(0, room);
  if (t.length > room) { const s = d.lastIndexOf(". "); d = s > 80 ? d.slice(0, s + 1) : d.slice(0, d.lastIndexOf(" ")).replace(/[,;:–-]+$/, "") + "…"; }
  if (d.length < 50) d = `${name}${d ? `: ${d}` : ""}`;
  if (!/[.!?…]$/.test(d)) d += ".";
  return (d + cta).trim();
}

export const gradeColor = (g: SeoResult["grade"]) => (g === "good" ? "bg-green-100 text-green-800" : g === "ok" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700");
